import React, { useState } from 'react'
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { HeroHeading } from './common/hero-heading'
import { contactInfo } from "../constants/data"
import { benefitsData } from "../constants/data"

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const response = await fetch('https://tcnemhaocanqvhimvuon.supabase.co/functions/v1/contact-us', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Contact form submitted successfully:', result)
      setSubmitStatus('success')

      // Reset form after successful submission
      setFormData({
        name: '',
        email: '',
        message: ''
      })
    } catch (error) {
      console.error('Error submitting contact form:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="contact" className="bg-white">
      <div className="bg-[#0d1518] py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <HeroHeading title="Kontakt oss" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  name="name"
                  placeholder="Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="bg-gray-200 border-gray-300 text-black placeholder:text-gray-500 h-12"
                />
                <Input
                  name="email"
                  placeholder="Email address"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="bg-gray-200 border-gray-300 text-black placeholder:text-gray-500 h-12"
                />
              </div>
              <Textarea
                name="message"
                placeholder="Message"
                rows={6}
                value={formData.message}
                onChange={handleInputChange}
                required
                className="bg-gray-200 border-gray-300 text-black placeholder:text-gray-500 resize-none"
              />

              {submitStatus === 'success' && (
                <p className="text-green-400 text-sm">Message sent successfully!</p>
              )}
              {submitStatus === 'error' && (
                <p className="text-red-400 text-sm">Failed to send message. Please try again.</p>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="bg-[#E3C08D] text-black hover:bg-[#d4b382] font-semibold px-8 py-3 hover:cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'SENDING...' : 'SUBMIT'}
              </Button>
            </form>

            <div className="space-y-8">
              <div className="space-y-6">
                {contactInfo.map((contact) => (
                  <div key={contact.id} className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-[#E3C08D] flex items-center justify-center flex-shrink-0 rounded-full">
                      {contact.icon}
                    </div>
                    <div>
                      <p className="text-white font-medium text-lg tracking-wide">{contact.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section - White Background */}
      <div className="bg-white py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 px-32 max-[1028px]:px-4">
            {benefitsData.map((benefit) => (
              <div key={benefit.id} className={`text-center ${benefit.customClass}`}>
                <div className={`${benefit.customClass ? '' : 'w-16 h-16 flex items-center justify-center mx-auto mb-4'}`}>
                  {benefit.icon}
                </div>
                <h3 className="font-bold text-black mb-2 tracking-wide whitespace-pre-line">
                  {benefit.title}
                </h3>
                {benefit.description && <p className="text-black">{benefit.description}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
      
    </section>
  )
}
