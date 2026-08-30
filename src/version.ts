type ParsedVersion = {
  core: bigint[];
  prerelease: Array<bigint | string> | null;
};

function parseVersion(value: string): ParsedVersion | null {
  const normalized = value.trim().replace(/^v(?=\d)/i, "");
  const withoutBuild = normalized.split("+", 1)[0];
  const prereleaseStart = withoutBuild.indexOf("-");
  const coreText = prereleaseStart === -1 ? withoutBuild : withoutBuild.slice(0, prereleaseStart);
  const prereleaseText = prereleaseStart === -1 ? null : withoutBuild.slice(prereleaseStart + 1);
  const coreParts = coreText.split(".");

  if (coreParts.length === 0 || coreParts.some((part) => !/^\d+$/.test(part))) return null;
  if (prereleaseText !== null && !prereleaseText) return null;

  const core = coreParts.map((part) => BigInt(part));
  while (core.length > 1 && core.at(-1) === 0n) core.pop();

  const prerelease = prereleaseText === null
    ? null
    : prereleaseText.split(".").map((part) => /^\d+$/.test(part) ? BigInt(part) : part.toLowerCase());

  if (prerelease?.some((part) => part === "")) return null;
  return { core, prerelease };
}

function compareIdentifiers(left: bigint | string, right: bigint | string): number {
  if (typeof left === "bigint" && typeof right === "bigint") {
    return left === right ? 0 : left > right ? 1 : -1;
  }
  if (typeof left === "bigint") return -1;
  if (typeof right === "bigint") return 1;
  return left.localeCompare(right);
}

/**
 * Compares dotted numeric versions using SemVer prerelease ordering. Versions
 * outside that format fall back to a natural string comparison so a catalog
 * with legacy version labels can still surface a changed release.
 */
export function compareVersions(left: string, right: string): number {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);

  if (!parsedLeft || !parsedRight) {
    return left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
  }

  const coreLength = Math.max(parsedLeft.core.length, parsedRight.core.length);
  for (let index = 0; index < coreLength; index += 1) {
    const leftPart = parsedLeft.core[index] ?? 0n;
    const rightPart = parsedRight.core[index] ?? 0n;
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1;
  }

  if (parsedLeft.prerelease === null && parsedRight.prerelease === null) return 0;
  if (parsedLeft.prerelease === null) return 1;
  if (parsedRight.prerelease === null) return -1;

  const prereleaseLength = Math.max(parsedLeft.prerelease.length, parsedRight.prerelease.length);
  for (let index = 0; index < prereleaseLength; index += 1) {
    const leftPart = parsedLeft.prerelease[index];
    const rightPart = parsedRight.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const comparison = compareIdentifiers(leftPart, rightPart);
    if (comparison !== 0) return comparison;
  }

  return 0;
}
