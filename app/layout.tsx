import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
	description: "Your AI at work",
	icons: {
		icon: [
			{ url: "/favicon.ico" },
			{
				url: "/favicon/favicon-black.ico",
				media: "(prefers-color-scheme: light)",
			},
			{
				url: "/favicon/favicon-white.ico",
				media: "(prefers-color-scheme: dark)",
			},
			{
				url: "/favicon/favicon-black-32.png",
				type: "image/png",
				sizes: "32x32",
				media: "(prefers-color-scheme: light)",
			},
			{
				url: "/favicon/favicon-white-32.png",
				type: "image/png",
				sizes: "32x32",
				media: "(prefers-color-scheme: dark)",
			},
			{
				url: "/favicon/favicon-black-16.png",
				type: "image/png",
				sizes: "16x16",
				media: "(prefers-color-scheme: light)",
			},
			{
				url: "/favicon/favicon-white-16.png",
				type: "image/png",
				sizes: "16x16",
				media: "(prefers-color-scheme: dark)",
			},
		],
		apple: [
			{
				url: "/favicon/apple-touch-icon-black.png",
				media: "(prefers-color-scheme: light)",
			},
			{
				url: "/favicon/apple-touch-icon-white.png",
				media: "(prefers-color-scheme: dark)",
			},
		],
		other: [
			{
				rel: "mask-icon",
				url: "/favicon/mask-icon-black.svg",
				color: "#0D0D0E",
				media: "(prefers-color-scheme: light)",
			},
			{
				rel: "mask-icon",
				url: "/favicon/mask-icon-white.svg",
				color: "#FBFCFC",
				media: "(prefers-color-scheme: dark)",
			},
		],
	},
	title: "Unison",
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#0D0D0E" },
		{ media: "(prefers-color-scheme: dark)", color: "#FBFCFC" },
	],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${GeistSans.variable} ${GeistMono.variable}`} lang="en">
			<body suppressHydrationWarning>
				<AppProviders>{children}</AppProviders>
			</body>
		</html>
	);
}
