import React, { useEffect, useState } from "react"
import "./Preloader.css"

export function Preloader({ onLoadingComplete }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          if (onLoadingComplete) {
            setTimeout(onLoadingComplete, 300)
          }
          return 100
        }
        return Math.min(prev + 10, 100)
      })
    }, 100)

    return () => clearInterval(interval)
  }, [onLoadingComplete])

  return (
    <div className="preloader-container">
      <div className="preloader-content">
        <div className="preloader-logo">
          <img
            src="/systra_logo.svg"
            alt="Systra Logo"
          />
        </div>

        <div className="preloader-spinner">
          <div className="preloader-spinner-outer"></div>
          <div className="preloader-spinner-rotating"></div>
          <div className="preloader-spinner-dot">
            <div className="preloader-spinner-dot-inner"></div>
          </div>
        </div>

        <div className="preloader-text">
          <p>Loading Risk Management System</p>
          <div className="preloader-dots">
            <div className="preloader-dot"></div>
            <div className="preloader-dot"></div>
            <div className="preloader-dot"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Preloader
