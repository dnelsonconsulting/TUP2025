import React from 'react'
import Image from 'next/image'
import miscioLogo from '../../public/miscio.png'

const Header: React.FC = () => (
  <div className="flex flex-col items-center mb-8 mt-4">
    <div className="bg-blue-400 rounded-full p-4 mb-2 border-2 border-gray-500">
      <Image src={miscioLogo} alt="Miscio Logo" width={48} height={48} />
    </div>
    <h1 className="text-3xl font-bold text-blue-500 mb-2 text-center">
      Miscio Transcript Uploader
    </h1>
    <p className="text-gray-500 text-center">
      Securely submit your student information and academic transcripts.
    </p>
  </div>
)

export default Header
