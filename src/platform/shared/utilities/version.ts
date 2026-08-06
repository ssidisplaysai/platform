type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

const semverPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parseSemver(value: string): ParsedSemver | undefined {
  const match = semverPattern.exec(value);
  if (!match) {
    return undefined;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

export function isSemverVersion(value: string): boolean {
  return Boolean(parseSemver(value));
}

function comparePrereleaseIdentifier(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
  }

  if (leftNumeric && !rightNumeric) {
    return -1;
  }

  if (!leftNumeric && rightNumeric) {
    return 1;
  }

  return left.localeCompare(right);
}

export function compareSemverVersions(left: string, right: string): number {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);
  if (!parsedLeft || !parsedRight) {
    throw new Error(`invalid semantic version comparison: ${left} vs ${right}`);
  }

  if (parsedLeft.major !== parsedRight.major) {
    return parsedLeft.major < parsedRight.major ? -1 : 1;
  }

  if (parsedLeft.minor !== parsedRight.minor) {
    return parsedLeft.minor < parsedRight.minor ? -1 : 1;
  }

  if (parsedLeft.patch !== parsedRight.patch) {
    return parsedLeft.patch < parsedRight.patch ? -1 : 1;
  }

  const leftPrerelease = parsedLeft.prerelease;
  const rightPrerelease = parsedRight.prerelease;
  if (leftPrerelease.length === 0 && rightPrerelease.length === 0) {
    return 0;
  }

  if (leftPrerelease.length === 0) {
    return 1;
  }

  if (rightPrerelease.length === 0) {
    return -1;
  }

  const length = Math.max(leftPrerelease.length, rightPrerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftPrerelease[index];
    const rightIdentifier = rightPrerelease[index];

    if (leftIdentifier === undefined) {
      return -1;
    }
    if (rightIdentifier === undefined) {
      return 1;
    }

    const comparison = comparePrereleaseIdentifier(leftIdentifier, rightIdentifier);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

export function assertVersion(value: string, label: string): void {
  if (!isSemverVersion(value)) {
    throw new Error(`invalid ${label} version: ${value}`);
  }
}
