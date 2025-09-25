import React from 'react'

export function HeroHeading({title}: {title: string}) {
    return (<h2 className="text-3xl md:text-4xl font-bold text-[#E3C08D] mb-8">{title}</h2>)
}

export function HeroDescription({description, className}: {description: string, className?: string}) {
    return (<p className={`text-gray-300 text-[20px] mb-6 ${className}`}>{description}</p>)
}