import pkg from "../../package.json";
import rawPortMetadata from "../../ports/millennium/upstream.json";

interface PortMetadata {
  portName: string;
  portVersion: string;
  portRepository: string | null;
  minimumMillenniumVersion: string;
  upstream: {
    repository: string;
    version: string;
    commit: string;
  };
}

const portMetadata = rawPortMetadata as PortMetadata;

export type RuntimeHostKind = "decky" | "millennium";

export function getRuntimeHostKind(): RuntimeHostKind {
  try {
    return (globalThis as any).__DECK_SHELVES_MILLENNIUM__ === true ? "millennium" : "decky";
  } catch {
    return "decky";
  }
}

export function getRuntimeVersion(): string {
  return getRuntimeHostKind() === "millennium"
    ? portMetadata.portVersion
    : ((pkg as any).version ?? "0.0.0");
}

export function getRuntimeVersionLabel(): string {
  if (getRuntimeHostKind() !== "millennium") return getRuntimeVersion();
  return `${portMetadata.portVersion} (upstream ${portMetadata.upstream.version})`;
}

function normalizedRepository(value: string | null): string | null {
  const trimmed = value?.trim().replace(/\/$/, "") ?? "";
  return trimmed || null;
}

export function getProjectLinks() {
  const upstreamRepository = normalizedRepository(portMetadata.upstream.repository)!;
  const portRepository = normalizedRepository(portMetadata.portRepository);
  const repository = getRuntimeHostKind() === "millennium" ? portRepository : upstreamRepository;
  return {
    sourceUrl: repository ?? upstreamRepository,
    upstreamUrl: upstreamRepository,
    releasesUrl: repository ? `${repository}/releases` : null,
    issuesUrl: repository ? `${repository}/issues/new` : null,
    releasesApiUrl: repository
      ? repository.replace("https://github.com/", "https://api.github.com/repos/") + "/releases"
      : null,
  };
}

export function getPortMetadata(): Readonly<PortMetadata> {
  return portMetadata;
}
