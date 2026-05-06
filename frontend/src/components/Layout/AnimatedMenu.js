import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, ChevronLeft, Home, Calendar, GraduationCap, Database, Receipt, CircleDollarSign, Users, FileText, TrendingUp, BarChart2 } from 'lucide-react';
import './AnimatedMenu.css';

const IconMap = {
  home: Home,
  calendar: Calendar,
  teaching: GraduationCap,
  topic: Database,
  log: Receipt,
  payments: CircleDollarSign,
  employees: Users,
  invoice: FileText,
  insights: TrendingUp,
  financial: BarChart2
};

export default function AnimatedMenu({ isOpen, setIsOpen, navItems }) {
  const dragX = useMotionValue(0);
  const dragOpacity = useTransform(dragX, [-200, 0], [0, 1]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x < -100) {
      setIsOpen(false);
    }
    dragX.set(0);
  };

  const menuVariants = {
    closed: {
      x: '-100%',
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 30,
        mass: 0.8,
      },
    },
    open: {
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 30,
        mass: 0.8,
      },
    },
  };

  const itemVariants = {
    closed: { x: -50, opacity: 0 },
    open: (i) => ({
      x: 0,
      opacity: 1,
      transition: {
        delay: 0.1 + i * 0.08,
        type: 'spring',
        stiffness: 250,
        damping: 25,
      },
    }),
  };

  const overlayVariants = {
    closed: { 
      opacity: 0,
      transition: {
        duration: 0.3,
      },
    },
    open: { 
      opacity: 1,
      transition: {
        duration: 0.4,
      },
    },
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={overlayVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={() => setIsOpen(false)}
            className="am-overlay"
          />
        )}
      </AnimatePresence>

      <motion.nav
        variants={menuVariants}
        initial="closed"
        animate={isOpen ? 'open' : 'closed'}
        drag="x"
        dragConstraints={{ left: -320, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="am-drawer"
      >
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(false)}
          onPointerDownCapture={(e) => e.stopPropagation()}
          className="am-close-btn"
          type="button"
        >
          <X size={24} />
        </motion.button>

        <motion.button
          style={{ opacity: dragOpacity }}
          className="am-drag-indicator"
          onClick={() => setIsOpen(false)}
          onPointerDownCapture={(e) => e.stopPropagation()}
          type="button"
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronLeft size={32} />
        </motion.button>

        <div className="am-nav-content">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            className="am-nav-header"
          >
            <h2>Navigation</h2>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 80 }}
              transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
              className="am-nav-underline"
            />
          </motion.div>

          <ul className="am-nav-list">
            {navItems.map((item, i) => {
              const Icon = IconMap[item.icon] || Home;
              return (
                <motion.li
                  key={item.label}
                  custom={i}
                  variants={itemVariants}
                  initial="closed"
                  animate={isOpen ? 'open' : 'closed'}
                >
                  <NavLink
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) => `am-nav-item ${isActive ? 'am-active' : ''}`}
                  >
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: 8 }}
                      whileTap={{ scale: 0.95 }}
                      className="am-icon-box"
                    >
                      <Icon size={24} />
                    </motion.div>
                    <span className="am-nav-label">{item.label}</span>
                  </NavLink>
                </motion.li>
              );
            })}
          </ul>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="am-drag-hint"
          >
            <p>💡 Drag left to close</p>
          </motion.div>
        </div>
      </motion.nav>
    </>
  );
}
