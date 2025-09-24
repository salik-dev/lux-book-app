import React, { ReactNode } from 'react';
import { Header } from '../header';
import { Footer } from '../footer';
import { ContactSection } from '../contact-section';

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  backgroundImage?: string;
}

export function PageLayout({ children, title, description, backgroundImage }: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section 
          className="relative py-20 md:py-32 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${backgroundImage || '/path/to/default-hero.jpg'})`,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backgroundBlendMode: 'overlay'
          }}
        >
          <div className="container mx-auto px-4 text-center text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto">{description}</p>
          </div>
        </section>

        {/* Page Content */}
        <section className="py-12 md:py-20 bg-white">
          <div className="container mx-auto px-4">
            {children}
          </div>
        </section>
      </main>

      <ContactSection />
      <Footer />
    </div>
  );
}