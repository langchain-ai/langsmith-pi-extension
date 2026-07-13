import * as os from "node:os";
import { execFileSync } from "node:child_process";

import { VERSION as PI_RUNTIME_VERSION } from "@earendil-works/pi-coding-agent";

import { INTEGRATION_VERSION } from "./version.js";

// ── Frozen coding-agent-v1 literals for the pi integration ───────────────────
export const LS_AGENT_PURPOSE = "coding";
export type LSAgentType = "root" | "subagent" | "middleware" | "compaction";
export const LS_INTEGRATION = "pi";
export const LS_AGENT_RUNTIME = "Pi";
export const LS_TRACE_SCHEMA_VERSION = "coding-agent-v1";

interface GitInfo {
  repository_url?: string;
  repository_provider?: string;
  repository_name?: string;
  git_branch?: string;
  git_commit_sha?: string;
}

const gitInfoCache = new Map<string, GitInfo>();

function runGit(cwd: string, args: string[]): string | undefined {
  try {
    const out = execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    }).trim();
    return out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

// Parse a git remote (https, ssh, or scp-style) into repository_* fields.
function parseRemote(remote: string): { url: string; provider: string; name: string } | undefined {
  let host: string | undefined;
  let repoPath: string | undefined;

  const scp = remote.match(/^[^/@]+@([^:/]+):(.+)$/);
  if (scp) {
    host = scp[1];
    repoPath = scp[2];
  } else {
    try {
      const parsed = new URL(remote);
      host = parsed.host;
      repoPath = parsed.pathname;
    } catch {
      return undefined;
    }
  }

  if (!host || !repoPath) return undefined;
  const name = repoPath.replace(/^\/+/, "").replace(/\.git$/, "");
  if (!name) return undefined;

  const provider = host.includes("github")
    ? "github"
    : host.includes("gitlab")
      ? "gitlab"
      : host.includes("bitbucket")
        ? "bitbucket"
        : "other";

  return { url: `https://${host}/${name}`, provider, name };
}

function getGitInfo(cwd: string): GitInfo {
  const cached = gitInfoCache.get(cwd);
  if (cached) return cached;

  const info: GitInfo = {};
  const remote = runGit(cwd, ["config", "--get", "remote.origin.url"]);
  if (remote) {
    const parsed = parseRemote(remote);
    if (parsed) {
      info.repository_url = parsed.url;
      info.repository_provider = parsed.provider;
      info.repository_name = parsed.name;
    } else {
      // Unparseable remote: retain the raw URL rather than discard it.
      info.repository_url = remote;
    }
  }
  info.git_branch = runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  info.git_commit_sha = runGit(cwd, ["rev-parse", "HEAD"]);

  gitInfoCache.set(cwd, info);
  return info;
}

function localUsername(): string | undefined {
  try {
    return os.userInfo().username || undefined;
  } catch {
    return undefined;
  }
}

const compact = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

export interface CodingAgentMetadataInput {
  /** Role of the run within the coding-agent trace. */
  agentType: LSAgentType;
  /** Stable conversation/session id — coding-agent-v1 thread_id. */
  threadId?: string;
  /** Current working directory for the trace. */
  cwd: string;
  /** 1-based USER-turn index (one per user prompt / root run). */
  turnNumber?: number;
}

/**
 * Shared coding-agent-v1 base contract for pi, stamped once on the root;
 * langsmith (>= 0.6.0) propagates it to child runs.
 */
export function codingAgentMetadata(input: CodingAgentMetadataInput): Record<string, unknown> {
  const git = getGitInfo(input.cwd);

  return compact({
    // Identity & grouping — always.
    ls_agent_purpose: LS_AGENT_PURPOSE,
    ls_agent_type: input.agentType,
    ls_integration: LS_INTEGRATION,
    ls_agent_runtime: LS_AGENT_RUNTIME,
    ls_trace_schema_version: LS_TRACE_SCHEMA_VERSION,
    thread_id: input.threadId,

    // Versions — where known.
    ls_integration_version: INTEGRATION_VERSION,
    ls_agent_runtime_version: PI_RUNTIME_VERSION,

    // User turn — 1-based, set on the root and propagated to descendants.
    turn_number: input.turnNumber,

    // Git & workspace — where known.
    repository_url: git.repository_url,
    repository_provider: git.repository_provider,
    repository_name: git.repository_name,
    git_branch: git.git_branch,
    git_commit_sha: git.git_commit_sha,
    cwd: input.cwd,

    // Attribution — contextual. pi exposes no stable user_id / user_email.
    local_username: localUsername(),
  });
}
