import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./WheelPagination.css";

export default function WheelPagination({
  totalPages = 10,
  visibleCount = 5,
  className = "",
  onChange,
  currentPage = 0
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (onChange) onChange(currentPage);
  }, [currentPage, onChange]);

  const prevPage = () => {
    if (onChange) onChange(Math.max(currentPage - 1, 0));
  };
  
  const nextPage = () => {
    if (onChange) onChange(Math.min(currentPage + 1, totalPages - 1));
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0 && onChange) {
      onChange(Math.max(currentPage - 1, 0));
    } else if (e.deltaY > 0 && onChange) {
      onChange(Math.min(currentPage + 1, totalPages - 1));
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [currentPage, totalPages, onChange]);

  // Determine visible pages based on current active page
  const getVisiblePages = () => {
    const pages = [];
    const half = Math.floor(visibleCount / 2);
    let start = currentPage - half;
    let end = currentPage + half;

    if (start < 0) {
      end += -start;
      start = 0;
    }
    if (end > totalPages - 1) {
      start -= end - (totalPages - 1);
      end = totalPages - 1;
      if (start < 0) start = 0;
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const visiblePages = getVisiblePages();

  if (totalPages <= 1) return null;

  return (
    <div ref={containerRef} className={`wheel-pagination-container ${className}`}>
      <button
        onClick={prevPage}
        disabled={currentPage === 0}
        className="wheel-nav-btn"
        aria-label="Previous Page"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="wheel-pages-wrapper">
        {visiblePages.map((p) => (
          <motion.button
            key={p}
            layout
            animate={{ scale: currentPage === p ? 1.2 : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`wheel-page-btn ${currentPage === p ? 'active' : ''}`}
            onClick={() => {
              if (onChange) onChange(p);
            }}
          >
            {p + 1}
          </motion.button>
        ))}
      </div>

      <button
        onClick={nextPage}
        disabled={currentPage === totalPages - 1}
        className="wheel-nav-btn"
        aria-label="Next Page"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
