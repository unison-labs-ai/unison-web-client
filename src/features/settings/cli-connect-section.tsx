"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useApi } from "@/lib/api-context";
import { Button } from "@/ui/button";
import { PageSection } from "@/ui/page-blocks";

// ---------------------------------------------------------------------------
// "Connect to your terminal / Claude Code" — three copy-paste commands that
// install the Unison CLI, authenticate THIS user's brain with a freshly minted
// (revocable) key, and install the brain skill for coding agents. The key is
// returned once by POST /v1/account/cli-token and never persisted client-side.
// ---------------------------------------------------------------------------

const INSTALL_CMD = "npm i -g @unisonlabs/cli";
const SKILL_CMD = "unison skill install";

function CopyButton({ value, label }: { value: string; label: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<Button
			aria-label={`Copy ${label}`}
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(value);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {
					toast.error("Couldn't copy — select and copy manually.");
				}
			}}
			size="icon"
			variant="ghost"
		>
			{copied ? <Check size={15} /> : <Copy size={15} />}
		</Button>
	);
}

function CommandStep({ n, title, command }: { n: number; title: string; command: string }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-ink-subtle text-sm">
				{n}. {title}
			</span>
			<div className="flex items-center gap-2 rounded-md border border-(--border) bg-surface px-3 py-2">
				<code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-ink text-sm">
					{command}
				</code>
				<CopyButton label={`step ${n}`} value={command} />
			</div>
		</div>
	);
}

export function CliConnectSection() {
	const api = useApi();
	const mint = useMutation({
		mutationFn: () => api.mintCliToken(),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Couldn't generate a token."),
	});

	const token = mint.data?.token;

	return (
		<PageSection
			description="Use your brain from the terminal and from coding agents (Claude Code, Cursor, …). Generate a one-time key, then paste these three commands."
			title="Connect to your terminal"
		>
			{!token && (
				<div className="flex flex-col items-start gap-3">
					<p className="text-ink-subtle text-sm">
						This mints a personal API key scoped to your brain. It is shown once — you can revoke it
						anytime with <code className="font-mono text-ink">unison auth keys revoke</code>.
					</p>
					<Button disabled={mint.isPending} onClick={() => mint.mutate()}>
						<Terminal size={14} />
						{mint.isPending ? "Generating…" : "Generate connection commands"}
					</Button>
				</div>
			)}

			{token && (
				<div className="flex flex-col gap-4">
					<CommandStep command={INSTALL_CMD} n={1} title="Install the Unison CLI" />
					<CommandStep
						command={`unison auth token ${token}`}
						n={2}
						title="Authenticate this machine (contains your key — keep it private)"
					/>
					<CommandStep command={SKILL_CMD} n={3} title="Install the brain skill for your agent" />
					<p className="text-ink-subtle text-sm">
						The key in step 2 is shown once. Re-generate here if you lose it; revoke old keys with{" "}
						<code className="font-mono text-ink">unison auth keys revoke &lt;id&gt;</code>.
					</p>
				</div>
			)}
		</PageSection>
	);
}
