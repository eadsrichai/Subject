import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ฐานข้อมูลรายวิชา ปวส. 2567 สาขาเทคโนโลยีสารสนเทศ",
  description:
    "ค้นหารายวิชาตามหลักสูตรประกาศนียบัตรวิชาชีพชั้นสูง พุทธศักราช 2567 สาขาวิชาเทคโนโลยีสารสนเทศ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
