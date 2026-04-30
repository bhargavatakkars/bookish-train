// Mock for server-only package
export default function serverOnly(): never {
  throw new Error("server-only should not be used in tests");
}
