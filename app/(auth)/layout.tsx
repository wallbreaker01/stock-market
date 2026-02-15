import Link from "next/link"
import Image from "next/image"
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { redirect } from "next/navigation";



const Layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) redirect('/');

  return (
    <main className="auth-layout">
      <section className="auth-left-section scrollbar-hide-default">
        <Link href="/" className="auth-logo">
          <Image src="/assets/icons/logo.svg" alt="Signalist logo" width={140} height={32} className="h-8 w-auto" />
        </Link>
        <div className="pb-6 lg:pb-8 flex-1">{children}</div>

      </section>

      <section className="auth-right-section">
        <div className="z-10 relative lg:mt-4 lg:mb-16">
          <blockquote className="auth-blockquote">
            Signalist is a powerful and intuitive tool designed to help you analyze and visualize your data with ease. With its user-friendly interface and robust features, Signalist empowers you to uncover insights, identify trends, and make informed decisions based on your data. Whether you're a data scientist, analyst, or business professional, Signalist provides the tools you need to turn raw data into actionable insights.
          </blockquote>
          <div className="flex items-center justify-between">
            <div>
              <cite className="auth-testimonial-author">- Sowmik Roy</cite>
              <p className="max-md:text-xs text-gray-500">CEO, TradingViewWidget</p>
            </div>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Image src="/assets/icons/star.svg" alt="Star" key={star} width={20} height={20} className="w-5 h-5" />
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 relative">
          <Image src="/assets/images/dashboard.png" alt="Dashboard Preview" width={1440} height={1150} className="auth-dashboard-preview" />
        </div>
      </section>



    </main>
  )
}

export default Layout