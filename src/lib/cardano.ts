/**
 * Cardano wallet integration (CIP-30).
 *
 * Eternl, Typhon, and other Cardano light wallets inject a CIP-30-compatible
 * API under `window.cardano.{walletKey}`.  We never touch private keys — the
 * wallet signs everything in-device.
 */

/** CIP-30 wallet API surface (subset we use). */
export interface CIP30API {
  enable: () => Promise<CIP30EnabledAPI>;
  isEnabled: () => Promise<boolean>;
  getApiVersion: () => Promise<string>;
  getName: () => Promise<string>;
  getIcon: () => Promise<string>;
}

export interface CIP30EnabledAPI {
  getBalance: () => Promise<string>;
  getChangeAddress: () => Promise<string>;
  getRewardAddresses: () => Promise<string[]>;
  getUsedAddresses: () => Promise<string[]>;
  getNetworkId: () => Promise<number>;
  signData: (
    address: string,
    payload: string,
  ) => Promise<{ key: string; signature: string }>;
  signTx: (
    txHex: string,
    partialSign?: boolean,
  ) => Promise<{ signature: string }>;
  submitTx: (txHex: string) => Promise<string>;
}

/** Metadata for a discoverable wallet. */
export interface WalletInfo {
  key: string;
  name: string;
  icon: string;
  apiVersion?: string;
}

/** The resolved, enabled wallet session stored in React state. */
export interface CardanoWalletSession {
  /** Bech32 change address (addr1… / addr_test1…) */
  address: string;
  /** Raw hex-encoded CBOR balance (lovelace + native assets). */
  balanceHex: string;
  /** Lovelace balance parsed from the hex (best-effort). */
  lovelace: bigint;
  /** 0 = testnet, 1 = mainnet */
  networkId: number;
  /** Wallet display name, e.g. "Eternl" */
  walletName: string;
  /** Internal wallet key, e.g. "eternl" */
  walletKey: string;
  /** The enabled CIP-30 API (for signing data / txs later). */
  api: CIP30EnabledAPI;
}

/** Wallets we look for on `window.cardano`. */
export const SUPPORTED_WALLETS: { key: string; name: string }[] = [
  { key: "eternl", name: "Eternl" },
  { key: "typhoncip30", name: "Typhon" },
  { key: "nami", name: "Nami" },
  { key: "flint", name: "Flint" },
  { key: "gero", name: "GeroWallet" },
  { key: "nufi", name: "NuFi" },
];

// ─── Network Configuration ────────────────────────────────────────────

/**
 * Cardano testnet (Preview) configuration.
 * The app is configured for testnet by default — real ADA is never at risk.
 * Network ID 0 = testnet, 1 = mainnet.
 */
export const TARGET_NETWORK_ID = 0; // Testnet (Preview)

/** Cardano testnet faucet URL for getting test ADA. */
export const TESTNET_FAUCET_URL = "https://docs.cardano.org/cardano-testnet/tools/faucet";

/** Blockfrost testnet API base URL. */
export const BLOCKFROST_TESTNET_URL = "https://cardano-preview.blockfrost.io/api/v0";

/** Is the app configured for testnet? */
export const IS_TESTNET = TARGET_NETWORK_ID === 0;

/** Network label for display. */
export const NETWORK_LABEL = IS_TESTNET ? "Testnet (Preview)" : "Mainnet";

/**
 * Check if the connected wallet is on the correct network.
 * Returns true if the wallet's networkId matches the target.
 */
export function isCorrectNetwork(walletNetworkId: number): boolean {
  return walletNetworkId === TARGET_NETWORK_ID;
}

/** Global augmentation for `window.cardano`. */
declare global {
  interface Window {
    cardano?: Record<string, CIP30API & { name?: string; icon?: string }>;
  }
}

/** Discover all injected Cardano wallets. */
export function discoverWallets(): WalletInfo[] {
  const c = window.cardano;
  if (!c) return [];
  const found: WalletInfo[] = [];
  for (const w of SUPPORTED_WALLETS) {
    const api = c[w.key];
    if (api) {
      found.push({
        key: w.key,
        name: api.name ?? w.name,
        icon: api.icon ?? "",
        apiVersion: undefined,
      });
    }
  }
  return found;
}

/**
 * Best-effort parse of a hex-encoded CBOR balance string returned by
 * `getBalance()`.  Cardano returns a CBOR-encoded `Value` = coin + multiasset.
 * We extract just the coin (lovelace) amount — the first map entry in the
 * simplest case.
 *
 * Returns the lovelace as a bigint, or 0n if parsing fails.
 */
export function parseLovelace(balanceHex: string): bigint {
  try {
    if (!balanceHex || balanceHex === "0") return 0n;
    // The CBOR for a simple coin value is: 58 + length-byte(s) + hex bytes
    // or just the unsigned integer encoding. For a single-asset Value it is
    // typically "5820" or just the bigint encoding.
    // We try to parse it as a CBOR unsigned integer directly.
    const hex = balanceHex.replace(/^0x/, "");
    // Try: if it's a plain hex number
    const direct = BigInt("0x" + hex);
    if (direct > 0n) return direct;
    return 0n;
  } catch {
    return 0n;
  }
}

/** Convert lovelace to a human-readable ADA string. */
export function formatAda(lovelace: bigint): string {
  const ada = Number(lovelace) / 1_000_000;
  return ada.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }) + " ₳";
}

/** Shorten an address for display, preserving the network prefix. */
export function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return addr.slice(0, 10) + "…" + addr.slice(-6);
}

/**
 * Enable a wallet and return a session object.
 * Throws a descriptive error if the wallet is not found or the user rejects.
 */
export async function enableWallet(
  walletKey: string,
): Promise<CardanoWalletSession> {
  const c = window.cardano;
  if (!c) {
    throw new Error(
      "No Cardano wallet found. Please install Eternl or Typhon.",
    );
  }

  const walletApi = c[walletKey];
  if (!walletApi) {
    const friendly =
      SUPPORTED_WALLETS.find((w) => w.key === walletKey)?.name ?? walletKey;
    throw new Error(
      `${friendly} wallet not found. Please install or activate it.`,
    );
  }

  const enabled = await walletApi.enable();

  const [changeAddress, balanceHex, networkId] = await Promise.all([
    enabled.getChangeAddress(),
    enabled.getBalance(),
    enabled.getNetworkId(),
  ]);

  // The change address is hex-encoded CBOR; decode to bech32.
  const address = await decodeAddress(changeAddress);

  const walletName =
    SUPPORTED_WALLETS.find((w) => w.key === walletKey)?.name ?? walletKey;

  return {
    address,
    balanceHex,
    lovelace: parseLovelace(balanceHex),
    networkId,
    walletName,
    walletKey,
    api: enabled,
  };
}

/**
 * Decode a hex-encoded Cardano address (CBOR) to bech32.
 * Uses the browser's `window.cardano` helper if available, otherwise attempts
 * a raw bech32 decode.  If all else fails, returns the hex string.
 */
async function decodeAddress(hexAddr: string): Promise<string> {
  // Many wallets return a raw bech32 string already (Typhon sometimes does)
  if (hexAddr.startsWith("addr") || hexAddr.startsWith("addr_test")) {
    return hexAddr;
  }

  // Try to decode using the wallet's own API (some wallets expose this).
  // Otherwise, return the hex — the wallet UI still shows it.
  try {
    // If it looks like hex, try to decode it to UTF-8 (some wallets return
    // the bech32 string as a hex-encoded byte array).
    const bytes = hexToString(hexAddr);
    if (bytes.startsWith("addr")) return bytes;
  } catch {
    // ignore
  }

  return hexAddr;
}

function hexToString(hex: string): string {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (byte === 0) break;
    str += String.fromCharCode(byte);
  }
  return str;
}

/**
 * Convert a UTF-8 string to a hex-encoded string.
 * CIP-30 `signData()` requires the payload to be hex-encoded bytes.
 */
export function stringToHex(str: string): string {
  // TextEncoder gives us UTF-8 bytes, then we map each byte to a 2-char hex pair.
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sign an arbitrary message with the connected wallet.
 * Used for login / registration proofs (similar to the `enrol` wallet-auth).
 *
 * Per CIP-30, the `payload` argument must be a **hex-encoded** byte string.
 * This helper converts the UTF-8 message to hex before calling `signData`.
 *
 * The `address` must also be the hex-encoded CBOR address — CIP-30 does not
 * accept bech32 here. We use `bech32ToHex()` to convert it.
 *
 * Returns the CIP-30 signature object `{ key, signature }`.
 */
export async function signMessage(
  api: CIP30EnabledAPI,
  address: string,
  message: string,
): Promise<{ key: string; signature: string }> {
  const hexAddress = bech32ToHex(address);
  const hexPayload = stringToHex(message);
  return api.signData(hexAddress, hexPayload);
}

/**
 * Sign a certificate/document proof with the connected wallet.
 * This creates a wallet signature over a hash of the document metadata,
 * proving the wallet owner has endorsed this certificate as authentic.
 *
 * In production, the Aiken smart contract validator would verify this
 * signature on-chain before accepting the certificate.
 */
export async function signCertificate(
  api: CIP30EnabledAPI,
  address: string,
  certData: { type: string; label: string; fileName?: string; fileSize?: number; uploadedAt: number },
): Promise<{ key: string; signature: string }> {
  const message = `TenderHub Certificate Verification:${address}:${certData.type}:${certData.label}:${certData.fileName ?? ""}:${certData.fileSize ?? 0}:${certData.uploadedAt}`;
  return signMessage(api, address, message);
}

/**
 * Convert a bech32 address (addr1… / addr_test1…) to the hex-encoded CBOR
 * byte string that CIP-30 `signData()` expects as its first argument.
 *
 * CIP-30 requires the address in its raw hex (CBOR-encoded) form — the bech32
 * string won't work. We decode bech32 to the raw bytes, then re-encode to hex.
 */
export function bech32ToHex(bech32: string): string {
  // The bech32 charset
  const charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

  // Quick check: if it's already hex, return as-is
  if (/^[0-9a-fA-F]+$/.test(bech32) && bech32.length % 2 === 0) {
    return bech32;
  }

  try {
    // Split into hrp and data part
    const lastOne = bech32.lastIndexOf("1");
    if (lastOne === -1) return bech32; // not bech32, return as-is

    const dataPart = bech32.slice(lastOne + 1);
    // Remove the 6-char checksum
    const dataNoChecksum = dataPart.slice(0, -6);

    // Convert from bech32 5-bit groups to 8-bit bytes
    const groups: number[] = [];
    for (const ch of dataNoChecksum) {
      groups.push(charset.indexOf(ch));
    }

    // Depadding: convert 5-bit groups to 8-bit bytes
    const bytes: number[] = [];
    let buffer = 0;
    let bitsLeft = 0;
    for (const group of groups) {
      buffer = (buffer << 5) | group;
      bitsLeft += 5;
      if (bitsLeft >= 8) {
        bitsLeft -= 8;
        bytes.push((buffer >> bitsLeft) & 0xff);
      }
    }
    // The remaining bits (if any) are padding and should be 0
    // The first byte is the address header (network + type), keep it.

    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // If decoding fails, return the original string and hope the wallet handles it
    return bech32;
  }
}
