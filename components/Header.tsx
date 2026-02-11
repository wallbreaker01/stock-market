import { Link } from 'lucide-react'
import Image from 'next/image'

const Header = () => {
  return (
    <header className='sticky top-0 header'>
        <div className='container header-wrapper'>
            <Link href="/">
            <Image src="logo.svg" alt="StockX Logo" width={140} height={32} className="cursor-pointer" />
            </Link>
        </div>
    </header>
  )
}

export default Header