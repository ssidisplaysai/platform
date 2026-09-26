import type {Metadata,Viewport} from "next";import "./globals.css";
export const metadata:Metadata={title:"Sports Connect Alpha",description:"Family-first youth sports coordination.",manifest:"/manifest.webmanifest"};
export const viewport:Viewport={themeColor:"#0b1220",width:"device-width",initialScale:1};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
