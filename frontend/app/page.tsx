'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VideoUpload from '@/components/VideoUpload';

export default function HomePage() {
  const router = useRouter();
  const [uploadComplete, setUploadComplete] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleUploadComplete = (id: string) => {
    setSessionId(id);
    setUploadComplete(true);
    
    setTimeout(() => {
      router.push(`/session/${id}`);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      {/* Header */}
      <header className="border-b border-[#EEEEEE] bg-white">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold">Function Insights</div>
            <nav className="flex items-center gap-8">
              <Link href="/sessions" className="text-[#666666] hover:text-[#111111] transition-colors text-sm font-medium">
                Sessions
              </Link>
              <Link href="/sessions" className="btn btn-primary">
                View Sessions
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFF8F3] via-[#FFFDF9] to-[#F5F8FF] opacity-50" />
        
        <div className="container mx-auto max-w-5xl text-center relative z-10">
          <h1 className="text-5xl md:text-6xl font-medium tracking-tight leading-[1.1] mb-6">
            Understand your users
            <br />
            like never before
          </h1>
          <p className="text-lg text-[#666666] mb-12 max-w-2xl mx-auto leading-relaxed">
            Upload session recordings and let AI analyze user behavior, detect friction points, 
            and provide actionable insights to improve your user experience.
          </p>

          {/* Upload Section */}
          <div className="card p-8 max-w-2xl mx-auto bg-white shadow-sm">
            {uploadComplete ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-[#2E7D32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium mb-2">Upload Successful</h3>
                <p className="text-[#666666] mb-6">
                  Your session is being analyzed. Redirecting to results...
                </p>
                <div className="spinner mx-auto"></div>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-medium mb-3">Upload Session Recording</h3>
                <p className="text-[#666666] mb-8">
                  Drag and drop your video file or click to browse
                </p>
                <VideoUpload onUploadComplete={handleUploadComplete} />
                <p className="text-sm text-[#999999] mt-6">
                  Supports MP4, AVI, MOV, MKV • Max 100MB
                </p>
              </>
            )}
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-[#666666]">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>No data stored</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Secure processing</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span>AI-powered analysis</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 border-t border-[#EEEEEE] bg-white">
        <div className="container mx-auto">
          <h2 className="text-3xl font-medium text-center mb-4">
            Powerful Analysis Features
          </h2>
          <p className="text-center text-[#666666] mb-12 max-w-2xl mx-auto">
            Get comprehensive insights into user behavior with our advanced analysis tools
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="p-8 rounded-xl hover:shadow-lg transition-shadow bg-[#FFFDF9]">
              <div className="w-12 h-12 bg-[#F5F1EA] rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <h3 className="font-medium text-lg mb-2">Mouse Tracking</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Track every mouse movement to understand user navigation patterns and interaction flows
              </p>
            </div>
            
            <div className="p-8 rounded-xl hover:shadow-lg transition-shadow bg-[#FFFDF9]">
              <div className="w-12 h-12 bg-[#F5F1EA] rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-lg mb-2">Friction Detection</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Automatically identify rage clicks, form errors, confusion, and abandonment points
              </p>
            </div>
            
            <div className="p-8 rounded-xl hover:shadow-lg transition-shadow bg-[#FFFDF9]">
              <div className="w-12 h-12 bg-[#F5F1EA] rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-medium text-lg mb-2">AI Analysis</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Get intelligent insights about user behavior, pain points, and optimization opportunities
              </p>
            </div>
            
            <div className="p-8 rounded-xl hover:shadow-lg transition-shadow bg-[#FFFDF9]">
              <div className="w-12 h-12 bg-[#F5F1EA] rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-medium text-lg mb-2">Heat Maps</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Visualize user activity with interactive heat map overlays showing engagement areas
              </p>
            </div>
            
            <div className="p-8 rounded-xl hover:shadow-lg transition-shadow bg-[#FFFDF9]">
              <div className="w-12 h-12 bg-[#F5F1EA] rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-medium text-lg mb-2">Detailed Metrics</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Track speed, distance, movements, clicks, scrolls, and interaction patterns precisely
              </p>
            </div>
            
            <div className="p-8 rounded-xl hover:shadow-lg transition-shadow bg-[#FFFDF9]">
              <div className="w-12 h-12 bg-[#F5F1EA] rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-lg mb-2">Team Collaboration</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Share insights and collaborate with your team through Slack integration
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 border-t border-[#EEEEEE]">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-medium text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-[#F5F1EA] rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                <span className="text-2xl font-semibold">1</span>
                <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 w-full h-0.5 bg-gradient-to-r from-[#E5E5E5] to-transparent" />
              </div>
              <h3 className="font-medium text-lg mb-3">Upload Video</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Record your screen showing user interactions or upload existing session recordings
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-[#F5F1EA] rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                <span className="text-2xl font-semibold">2</span>
                <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 w-full h-0.5 bg-gradient-to-r from-[#E5E5E5] to-transparent" />
              </div>
              <h3 className="font-medium text-lg mb-3">AI Analysis</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Our AI processes the video to detect mouse movements, clicks, and behavior patterns
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-[#F5F1EA] rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-semibold">3</span>
              </div>
              <h3 className="font-medium text-lg mb-3">Get Insights</h3>
              <p className="text-sm text-[#666666] leading-relaxed">
                Receive detailed analysis with friction points, metrics, and actionable recommendations
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#111111] to-[#222222] text-white">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-medium mb-6">
            Start improving your UX today
          </h2>
          <p className="text-lg text-white/80 mb-8">
            Join teams using data-driven insights to create better user experiences
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#upload" className="btn btn-primary bg-white text-[#111111] hover:bg-[#F5F5F5]">
              Upload Your First Video
            </a>
            <Link href="/sessions" className="btn btn-secondary border-white/20 text-white hover:bg-white/10">
              View Example Analysis
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#EEEEEE] bg-white">
        <div className="container mx-auto text-center">
          <p className="text-sm text-[#999999]">
            © 2024 Function Insights. Built for better user experiences.
          </p>
        </div>
      </footer>
    </div>
  );
}