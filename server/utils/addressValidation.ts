import type { Network } from "@shared/schema";
import { createHash } from "crypto";

export interface AddressValidationResult {
  valid: boolean;
  address: string;
  network: Network;
  checksumAddress?: string;
  error?: string;
}

export function validateEvmAddress(address: string): { valid: boolean; checksumAddress?: string; error?: string } {
  if (!address) {
    return { valid: false, error: 'Address is required' };
  }

  if (!address.startsWith('0x')) {
    return { valid: false, error: 'EVM address must start with 0x' };
  }

  if (address.length !== 42) {
    return { valid: false, error: 'EVM address must be 42 characters long' };
  }

  const hexPart = address.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    return { valid: false, error: 'Invalid hexadecimal characters in address' };
  }

  const checksumAddress = toChecksumAddress(address);
  
  return { valid: true, checksumAddress };
}

export function validateTronAddress(address: string): { valid: boolean; error?: string } {
  if (!address) {
    return { valid: false, error: 'Address is required' };
  }

  if (!address.startsWith('T')) {
    return { valid: false, error: 'Tron address must start with T' };
  }

  if (address.length !== 34) {
    return { valid: false, error: 'Tron address must be 34 characters long' };
  }

  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  if (!base58Regex.test(address)) {
    return { valid: false, error: 'Invalid Base58 characters in Tron address' };
  }

  return { valid: true };
}

export function validateAddress(address: string, network: Network): AddressValidationResult {
  if (network === 'tron') {
    const result = validateTronAddress(address);
    return {
      valid: result.valid,
      address,
      network,
      error: result.error,
    };
  }

  const result = validateEvmAddress(address);
  return {
    valid: result.valid,
    address,
    network,
    checksumAddress: result.checksumAddress,
    error: result.error,
  };
}

function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = keccak256(addr);
  let checksumAddress = '0x';

  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksumAddress += addr[i].toUpperCase();
    } else {
      checksumAddress += addr[i];
    }
  }

  return checksumAddress;
}

function keccak256(data: string): string {
  return createHash('sha3-256').update(data).digest('hex');
}

export function normalizeAddress(address: string, network: Network): string {
  if (network === 'tron') {
    return address;
  }
  return address.toLowerCase();
}

export function isValidPaymentAddress(address: string, network: Network): boolean {
  return validateAddress(address, network).valid;
}
