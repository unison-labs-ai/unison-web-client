"use client";

/**
 * Shared switch primitive for boolean settings.
 *
 * Track ON = --primary with a --primary-foreground knob; track OFF =
 * --surface with an --ink-subtle knob, so the knob reads against the track
 * in both states (no white-on-white).
 */
export function Toggle({
	checked,
	disabled,
	onCheckedChange,
	"aria-label": ariaLabel,
}: {
	checked: boolean;
	disabled?: boolean;
	onCheckedChange: (checked: boolean) => void;
	"aria-label"?: string;
}) {
	return (
		<button
			aria-checked={checked}
			aria-label={ariaLabel ?? (checked ? "Disable" : "Enable")}
			className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
			disabled={disabled}
			onClick={() => onCheckedChange(!checked)}
			role="switch"
			style={{
				background: checked ? "var(--primary)" : "var(--surface)",
				border: "none",
				borderRadius: "999px",
				display: "inline-flex",
				flexShrink: 0,
				height: "20px",
				opacity: disabled ? 0.5 : 1,
				padding: "2px",
				transition: "background-color 180ms ease",
				width: "36px",
			}}
			type="button"
		>
			<span
				style={{
					background: checked ? "var(--primary-foreground)" : "var(--ink-subtle)",
					borderRadius: "50%",
					display: "block",
					height: "16px",
					transform: checked ? "translateX(16px)" : "translateX(0)",
					transition: "transform 180ms ease, background-color 180ms ease",
					width: "16px",
				}}
			/>
		</button>
	);
}
