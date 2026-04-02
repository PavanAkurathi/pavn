"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { industryHighlights } from "@/lib/how-it-works-content";

export function CoverageMediaGrid() {
  return (
    <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {industryHighlights.map((item) => (
        <CoverageMediaCard
          key={item.slug}
          title={item.title}
          body={item.summary}
          href={item.href ?? `/how-it-works/businesses#${item.slug}`}
          posterSrc={item.posterSrc}
          videoSrc={item.videoSrc}
        />
      ))}
    </div>
  );
}

function CoverageMediaCard({
  title,
  body,
  href,
  posterSrc,
  videoSrc,
}: {
  title: string;
  body: string;
  href: string;
  posterSrc: string;
  videoSrc: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleEnter = async () => {
    setIsHovered(true);

    if (!videoRef.current) {
      return;
    }

    try {
      videoRef.current.currentTime = 0;
      await videoRef.current.play();
    } catch {
      setIsHovered(false);
    }
  };

  const handleLeave = () => {
    setIsHovered(false);

    if (!videoRef.current) {
      return;
    }

    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) {
      return;
    }

    if (videoRef.current.currentTime >= 2) {
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Link
      href={href}
      aria-label={`${title} workflow details`}
      className="group relative block min-h-[15.5rem] overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.16)] focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-4"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <img
        src={posterSrc}
        alt={title}
        className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
          isHovered ? "scale-[1.03] opacity-0" : "scale-100 opacity-100"
        }`}
      />

      <video
        ref={videoRef}
        muted
        playsInline
        preload="metadata"
        poster={posterSrc}
        onTimeUpdate={handleTimeUpdate}
        className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
          isHovered ? "scale-[1.04] opacity-100" : "scale-100 opacity-0"
        }`}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>

      <div
        className={`absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04)_24%,rgba(15,23,42,0.72)_100%)] transition duration-300 ${
          isHovered ? "opacity-100" : "opacity-90"
        }`}
      />

      <div className="relative flex h-full flex-col justify-end p-6">
        <h3 className="text-2xl font-semibold tracking-tight text-white">
          {title}
        </h3>
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isHovered ? "mt-3 max-h-28 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <p className="max-w-sm text-sm leading-6 text-white/82">{body}</p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">
            <span>See workflow</span>
            <span
              aria-hidden="true"
              className="transition duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1"
            >
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
