"use client";

import React from "react";

interface EquipmentIllustrationProps {
  iconType: string;
  name: string;
  isDark?: boolean;
  className?: string;
}

export function EquipmentIllustration({
  iconType,
  name,
  isDark = true,
  className = "w-full h-full",
}: EquipmentIllustrationProps) {
  // Theme reactive accent colors
  const accentPrimary = isDark ? "#FF5A2C" : "#2563eb";
  const accentSecondary = isDark ? "#f97316" : "#3b82f6";
  const accentTertiary = isDark ? "#fbbf24" : "#60a5fa";
  const metalBody = isDark ? "#334155" : "#64748b";
  const metalLight = isDark ? "#94a3b8" : "#cbd5e1";
  const metalDark = isDark ? "#1e293b" : "#475569";
  const frameColor = isDark ? "#0f172a" : "#334155";
  const padColor = isDark ? "#1e293b" : "#1e293b";

  const renderIllustration = () => {
    switch (iconType) {
      case "dumbbell":
        return (
          <g transform="translate(10, 10)">
            {/* Center Knurled Handle */}
            <rect x="70" y="55" width="60" height="10" rx="3" fill={metalLight} />
            <line x1="80" y1="55" x2="80" y2="65" stroke={metalDark} strokeWidth="1" strokeDasharray="2 2" />
            <line x1="90" y1="55" x2="90" y2="65" stroke={metalDark} strokeWidth="1" strokeDasharray="2 2" />
            <line x1="100" y1="55" x2="100" y2="65" stroke={metalDark} strokeWidth="1" strokeDasharray="2 2" />
            <line x1="110" y1="55" x2="110" y2="65" stroke={metalDark} strokeWidth="1" strokeDasharray="2 2" />
            <line x1="120" y1="55" x2="120" y2="65" stroke={metalDark} strokeWidth="1" strokeDasharray="2 2" />
            {/* Left Plates */}
            <rect x="52" y="35" width="18" height="50" rx="5" fill={metalDark} />
            <rect x="36" y="25" width="16" height="70" rx="6" fill={frameColor} stroke={accentPrimary} strokeWidth="2" />
            <rect x="22" y="32" width="14" height="56" rx="5" fill={metalDark} />
            <rect x="14" y="56" width="8" height="8" rx="2" fill={metalLight} />
            {/* Right Plates */}
            <rect x="130" y="35" width="18" height="50" rx="5" fill={metalDark} />
            <rect x="148" y="25" width="16" height="70" rx="6" fill={frameColor} stroke={accentPrimary} strokeWidth="2" />
            <rect x="164" y="32" width="14" height="56" rx="5" fill={metalDark} />
            <rect x="178" y="56" width="8" height="8" rx="2" fill={metalLight} />
            {/* Accent Highlight Glow */}
            <circle cx="100" cy="60" r="45" fill={accentPrimary} opacity="0.12" filter="blur(16px)" />
          </g>
        );

      case "barbell":
        return (
          <g transform="translate(10, 10)">
            {/* Long Steel Bar */}
            <rect x="10" y="57" width="180" height="6" rx="2" fill={metalLight} />
            {/* Center Grip Knurl Marks */}
            <rect x="65" y="56" width="30" height="8" rx="2" fill={accentSecondary} opacity="0.6" />
            <rect x="105" y="56" width="30" height="8" rx="2" fill={accentSecondary} opacity="0.6" />
            {/* Left Sleeves & Olympic Bumper Plates */}
            <rect x="42" y="54" width="6" height="12" rx="1" fill={metalLight} />
            <rect x="34" y="20" width="8" height="80" rx="3" fill={accentPrimary} />
            <rect x="26" y="25" width="8" height="70" rx="3" fill={frameColor} stroke={metalLight} strokeWidth="1" />
            <rect x="18" y="32" width="8" height="56" rx="3" fill={metalDark} />
            <rect x="12" y="53" width="6" height="14" rx="2" fill={accentTertiary} />
            {/* Right Sleeves & Olympic Bumper Plates */}
            <rect x="152" y="54" width="6" height="12" rx="1" fill={metalLight} />
            <rect x="158" y="20" width="8" height="80" rx="3" fill={accentPrimary} />
            <rect x="166" y="25" width="8" height="70" rx="3" fill={frameColor} stroke={metalLight} strokeWidth="1" />
            <rect x="174" y="32" width="8" height="56" rx="3" fill={metalDark} />
            <rect x="182" y="53" width="6" height="14" rx="2" fill={accentTertiary} />
          </g>
        );

      case "bench":
        return (
          <g transform="translate(10, 10)">
            {/* Bench Frame Legs */}
            <path d="M40 95 L40 65 L160 65 L160 95" stroke={metalDark} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M25 95 L55 95 M145 95 L175 95" stroke={metalDark} strokeWidth="5" strokeLinecap="round" />
            {/* Angular Adjuster Bracket */}
            <line x1="100" y1="65" x2="130" y2="40" stroke={metalLight} strokeWidth="4" />
            <circle cx="100" cy="65" r="4" fill={accentPrimary} />
            {/* Incline Padded Backrest */}
            <rect x="85" y="25" width="85" height="14" rx="4" transform="rotate(-22 85 25)" fill={padColor} stroke={accentPrimary} strokeWidth="2.5" />
            {/* Flat Seat Pad */}
            <rect x="42" y="55" width="45" height="12" rx="3" fill={padColor} stroke={metalLight} strokeWidth="2" />
          </g>
        );

      case "rack":
        return (
          <g transform="translate(10, 10)">
            {/* Cage Vertical Uprights */}
            <rect x="35" y="15" width="10" height="85" rx="2" fill={frameColor} stroke={metalLight} strokeWidth="1" />
            <rect x="155" y="15" width="10" height="85" rx="2" fill={frameColor} stroke={metalLight} strokeWidth="1" />
            {/* Overhead Crossbar / Pullup */}
            <rect x="30" y="20" width="140" height="6" rx="2" fill={metalDark} />
            <path d="M70 20 Q100 8 130 20" stroke={accentPrimary} strokeWidth="3" fill="none" />
            {/* J-Hooks with Barbell Racked */}
            <rect x="42" y="45" width="8" height="10" rx="1" fill={accentTertiary} />
            <rect x="150" y="45" width="8" height="10" rx="1" fill={accentTertiary} />
            <line x1="20" y1="48" x2="180" y2="48" stroke={metalLight} strokeWidth="4" strokeLinecap="round" />
            {/* Safety Spotter Arms */}
            <rect x="35" y="70" width="130" height="6" rx="2" fill={accentPrimary} opacity="0.8" />
            {/* Base Supports */}
            <rect x="25" y="94" width="150" height="6" rx="2" fill={frameColor} />
          </g>
        );

      case "smith":
        return (
          <g transform="translate(10, 10)">
            {/* Vertical Guide Pillars */}
            <rect x="40" y="15" width="8" height="85" rx="2" fill={metalDark} />
            <rect x="152" y="15" width="8" height="85" rx="2" fill={metalDark} />
            {/* Guide Rails (Chrome) */}
            <line x1="52" y1="18" x2="52" y2="95" stroke={metalLight} strokeWidth="3" strokeDasharray="1 3" />
            <line x1="148" y1="18" x2="148" y2="95" stroke={metalLight} strokeWidth="3" strokeDasharray="1 3" />
            {/* Sliding Carriage & Barbell */}
            <rect x="47" y="48" width="10" height="14" rx="2" fill={accentPrimary} />
            <rect x="143" y="48" width="10" height="14" rx="2" fill={accentPrimary} />
            <line x1="25" y1="55" x2="175" y2="55" stroke={metalLight} strokeWidth="5" strokeLinecap="round" />
            {/* Rotating Lock Hooks */}
            <path d="M57 52 Q62 48 57 44" stroke={accentTertiary} strokeWidth="3" fill="none" />
            <path d="M143 52 Q138 48 143 44" stroke={accentTertiary} strokeWidth="3" fill="none" />
            {/* Safety Stop Springs at Bottom */}
            <rect x="48" y="78" width="8" height="8" rx="1" fill={accentSecondary} />
            <rect x="144" y="78" width="8" height="8" rx="1" fill={accentSecondary} />
          </g>
        );

      case "cable":
        return (
          <g transform="translate(10, 10)">
            {/* Dual Towers Frame */}
            <rect x="25" y="15" width="22" height="85" rx="3" fill={frameColor} stroke={metalDark} strokeWidth="1" />
            <rect x="153" y="15" width="22" height="85" rx="3" fill={frameColor} stroke={metalDark} strokeWidth="1" />
            {/* Top Connector Arch */}
            <path d="M36 20 Q100 8 164 20" stroke={metalLight} strokeWidth="4" fill="none" />
            {/* Weight Stacks */}
            <rect x="29" y="45" width="14" height="45" rx="1" fill={metalDark} />
            <line x1="36" y1="45" x2="36" y2="90" stroke={accentTertiary} strokeWidth="1.5" />
            <rect x="157" y="45" width="14" height="45" rx="1" fill={metalDark} />
            <line x1="164" y1="45" x2="164" y2="90" stroke={accentTertiary} strokeWidth="1.5" />
            {/* Pulleys and Cable Crossover */}
            <circle cx="45" cy="35" r="5" fill={accentPrimary} />
            <circle cx="155" cy="35" r="5" fill={accentPrimary} />
            <path d="M45 35 Q100 70 85 80" stroke={accentSecondary} strokeWidth="2" strokeDasharray="3 2" fill="none" />
            <path d="M155 35 Q100 70 115 80" stroke={accentSecondary} strokeWidth="2" strokeDasharray="3 2" fill="none" />
            {/* D-Handles */}
            <circle cx="85" cy="80" r="4" fill="none" stroke={metalLight} strokeWidth="2" />
            <circle cx="115" cy="80" r="4" fill="none" stroke={metalLight} strokeWidth="2" />
          </g>
        );

      case "lat":
        return (
          <g transform="translate(10, 10)">
            {/* Top Beam with Pulley Overhang */}
            <path d="M60 95 L60 20 Q60 12 70 12 L130 12" stroke={frameColor} strokeWidth="6" strokeLinecap="round" fill="none" />
            {/* Back Weight Stack Tower */}
            <rect x="48" y="35" width="24" height="60" rx="2" fill={metalDark} />
            <line x1="60" y1="35" x2="60" y2="95" stroke={accentTertiary} strokeWidth="2" />
            {/* Top Pulley Wheel */}
            <circle cx="130" cy="12" r="6" fill={metalLight} />
            {/* Drop Cable and Wide Lat Bar */}
            <line x1="130" y1="18" x2="130" y2="38" stroke={accentSecondary} strokeWidth="2" />
            <path d="M85 45 Q130 38 175 45" stroke={accentPrimary} strokeWidth="5" strokeLinecap="round" fill="none" />
            {/* Seat and Thigh Roller Pads */}
            <rect x="110" y="70" width="40" height="10" rx="3" fill={padColor} />
            <circle cx="120" cy="58" r="7" fill={accentPrimary} opacity="0.9" />
            <circle cx="140" cy="58" r="7" fill={accentPrimary} opacity="0.9" />
            <rect x="127" y="80" width="6" height="15" rx="1" fill={metalDark} />
          </g>
        );

      case "row":
        return (
          <g transform="translate(10, 10)">
            {/* Horizontal Rail Base */}
            <line x1="30" y1="85" x2="170" y2="85" stroke={metalDark} strokeWidth="6" strokeLinecap="round" />
            {/* Low Pulley Weight Tower */}
            <rect x="25" y="30" width="22" height="60" rx="2" fill={frameColor} stroke={metalDark} strokeWidth="1" />
            <rect x="29" y="45" width="14" height="40" rx="1" fill={metalLight} opacity="0.5" />
            {/* Low Pulley Wheel */}
            <circle cx="50" cy="80" r="5" fill={accentPrimary} />
            {/* Foot Rest Plates */}
            <rect x="65" y="65" width="6" height="20" rx="2" transform="rotate(15 65 65)" fill={metalLight} />
            {/* Cable and V-Handle */}
            <line x1="55" y1="78" x2="115" y2="60" stroke={accentSecondary} strokeWidth="2" strokeDasharray="3 2" />
            <path d="M115 56 L125 60 L115 64 Z" fill={accentTertiary} />
            {/* Sliding Seat */}
            <rect x="130" y="72" width="35" height="10" rx="3" fill={padColor} stroke={accentPrimary} strokeWidth="2" />
          </g>
        );

      case "chest":
        return (
          <g transform="translate(10, 10)">
            {/* Machine Frame */}
            <path d="M40 95 L40 25 L100 25" stroke={frameColor} strokeWidth="6" strokeLinecap="round" fill="none" />
            <rect x="30" y="40" width="20" height="55" rx="2" fill={metalDark} />
            {/* Ergonomic Seat & Backrest */}
            <rect x="85" y="38" width="12" height="42" rx="3" fill={padColor} stroke={metalLight} strokeWidth="1.5" />
            <rect x="85" y="80" width="30" height="10" rx="3" fill={padColor} />
            {/* Pivot Arm & Press Handles */}
            <circle cx="70" cy="30" r="6" fill={metalLight} />
            <path d="M70 30 L115 48 L145 52" stroke={accentPrimary} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <rect x="142" y="45" width="8" height="16" rx="3" fill={accentTertiary} />
            {/* Base */}
            <line x1="25" y1="95" x2="135" y2="95" stroke={metalDark} strokeWidth="5" strokeLinecap="round" />
          </g>
        );

      case "fly":
        return (
          <g transform="translate(10, 10)">
            {/* Central Tower */}
            <rect x="88" y="15" width="24" height="85" rx="3" fill={frameColor} stroke={metalDark} strokeWidth="1" />
            <rect x="93" y="35" width="14" height="55" rx="1" fill={metalDark} />
            {/* Top Overhead Pivot Wings */}
            <circle cx="70" cy="22" r="5" fill={accentPrimary} />
            <circle cx="130" cy="22" r="5" fill={accentPrimary} />
            {/* Dual Curved Fly Arms */}
            <path d="M70 22 Q40 45 45 70" stroke={metalLight} strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M130 22 Q160 45 155 70" stroke={metalLight} strokeWidth="4" strokeLinecap="round" fill="none" />
            {/* Armrest Pads & Handles */}
            <rect x="38" y="50" width="12" height="24" rx="4" fill={padColor} stroke={accentPrimary} strokeWidth="2" />
            <rect x="150" y="50" width="12" height="24" rx="4" fill={padColor} stroke={accentPrimary} strokeWidth="2" />
            {/* Seat */}
            <rect x="85" y="75" width="30" height="8" rx="2" fill={padColor} />
          </g>
        );

      case "shoulder":
        return (
          <g transform="translate(10, 10)">
            {/* Machine Frame Column */}
            <path d="M45 95 L45 20 L80 20" stroke={frameColor} strokeWidth="6" strokeLinecap="round" fill="none" />
            <rect x="35" y="40" width="20" height="55" rx="2" fill={metalDark} />
            {/* Upright Seat Back */}
            <rect x="80" y="35" width="10" height="45" rx="2" fill={padColor} stroke={metalLight} strokeWidth="1.5" />
            <rect x="80" y="80" width="28" height="8" rx="2" fill={padColor} />
            {/* Overhead Lever Arm */}
            <circle cx="65" cy="40" r="5" fill={metalLight} />
            <path d="M65 40 L95 25 L125 22" stroke={accentPrimary} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <rect x="120" y="16" width="14" height="8" rx="2" fill={accentTertiary} />
            <line x1="30" y1="95" x2="130" y2="95" stroke={metalDark} strokeWidth="5" strokeLinecap="round" />
          </g>
        );

      case "legpress":
        return (
          <g transform="translate(10, 10)">
            {/* 45 Degree Diagonal Rails */}
            <line x1="40" y1="95" x2="155" y2="20" stroke={frameColor} strokeWidth="8" strokeLinecap="round" />
            <line x1="50" y1="95" x2="165" y2="20" stroke={metalDark} strokeWidth="4" strokeLinecap="round" />
            {/* Heavy Footplate (Top Diagonal) */}
            <rect x="135" y="15" width="35" height="14" rx="3" transform="rotate(-45 135 15)" fill={accentPrimary} stroke={metalLight} strokeWidth="2" />
            {/* Weight Plate Horn on Sled */}
            <circle cx="120" cy="45" r="14" fill={frameColor} stroke={accentTertiary} strokeWidth="3" />
            <circle cx="120" cy="45" r="5" fill={metalLight} />
            {/* Reclined Bucket Seat at Bottom */}
            <path d="M45 75 L65 85 L90 85" stroke={padColor} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Safety Lock Handle */}
            <circle cx="70" cy="90" r="4" fill={accentSecondary} />
          </g>
        );

      case "extension":
        return (
          <g transform="translate(10, 10)">
            {/* Frame & Tower */}
            <rect x="30" y="30" width="22" height="65" rx="2" fill={frameColor} />
            <line x1="41" y1="35" x2="41" y2="90" stroke={accentTertiary} strokeWidth="1.5" />
            {/* Seat & Backrest */}
            <rect x="80" y="35" width="10" height="35" rx="2" fill={padColor} />
            <rect x="75" y="70" width="38" height="10" rx="3" fill={padColor} stroke={metalLight} strokeWidth="1" />
            {/* Knee Axis Cam Pivot */}
            <circle cx="115" cy="72" r="8" fill={accentPrimary} />
            {/* Lower Leg Lever Arm & Roller */}
            <line x1="115" y1="72" x2="145" y2="52" stroke={metalLight} strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="145" cy="52" r="8" fill={padColor} stroke={accentPrimary} strokeWidth="2.5" />
          </g>
        );

      case "curl":
        return (
          <g transform="translate(10, 10)">
            {/* Machine Frame */}
            <rect x="30" y="30" width="22" height="65" rx="2" fill={frameColor} />
            {/* Prone Bench / Seat */}
            <rect x="70" y="55" width="65" height="14" rx="3" fill={padColor} stroke={metalLight} strokeWidth="1.5" />
            {/* Pivot Joint at Knee */}
            <circle cx="135" cy="55" r="7" fill={accentPrimary} />
            {/* Heel Roller Arm Downwards */}
            <line x1="135" y1="55" x2="155" y2="78" stroke={metalLight} strokeWidth="4" strokeLinecap="round" />
            <circle cx="155" cy="78" r="8" fill={padColor} stroke={accentPrimary} strokeWidth="2.5" />
          </g>
        );

      case "calf":
        return (
          <g transform="translate(10, 10)">
            {/* Standing Frame Pillar */}
            <rect x="40" y="15" width="12" height="85" rx="2" fill={frameColor} stroke={metalDark} strokeWidth="1" />
            {/* Shoulder Pads Assembly */}
            <rect x="65" y="25" width="25" height="12" rx="3" fill={padColor} stroke={accentPrimary} strokeWidth="2" />
            <rect x="110" y="25" width="25" height="12" rx="3" fill={padColor} stroke={accentPrimary} strokeWidth="2" />
            <line x1="52" y1="31" x2="135" y2="31" stroke={metalLight} strokeWidth="5" />
            {/* Raised Calf Foot Block Platform */}
            <rect x="75" y="88" width="55" height="10" rx="2" fill={metalDark} stroke={metalLight} strokeWidth="1" />
            <path d="M85 88 L95 72 M120 88 L130 72" stroke={accentTertiary} strokeWidth="2" strokeDasharray="2 2" />
          </g>
        );

      case "assisted":
        return (
          <g transform="translate(10, 10)">
            {/* Tall Cage Uprights */}
            <rect x="40" y="10" width="8" height="90" rx="1" fill={frameColor} />
            <rect x="152" y="10" width="8" height="90" rx="1" fill={frameColor} />
            {/* Multi-Grip Pullup Bar Header */}
            <path d="M35 15 L80 15 L90 22 L110 22 L120 15 L165 15" stroke={accentPrimary} strokeWidth="4" strokeLinecap="round" fill="none" />
            {/* Dip Handles */}
            <line x1="55" y1="48" x2="75" y2="48" stroke={accentTertiary} strokeWidth="4" strokeLinecap="round" />
            <line x1="125" y1="48" x2="145" y2="48" stroke={accentTertiary} strokeWidth="4" strokeLinecap="round" />
            {/* Knee Assist Platform on Central Guide */}
            <rect x="80" y="60" width="40" height="12" rx="3" fill={padColor} stroke={accentPrimary} strokeWidth="2" />
            <line x1="100" y1="20" x2="100" y2="95" stroke={metalLight} strokeWidth="2.5" />
          </g>
        );

      case "treadmill":
        return (
          <g transform="translate(10, 10)">
            {/* Elevated Running Deck */}
            <path d="M25 85 L145 75 L165 85 L35 95 Z" fill={frameColor} stroke={metalDark} strokeWidth="1.5" />
            <rect x="35" y="78" width="115" height="10" rx="1" transform="rotate(-5 35 78)" fill="#020617" stroke={accentPrimary} strokeWidth="1" />
            {/* Upright Arms & Handrails */}
            <path d="M135 75 L145 35 L170 35" stroke={metalLight} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M120 77 L130 38" stroke={metalDark} strokeWidth="3" fill="none" />
            {/* LED Console Display */}
            <rect x="140" y="24" width="28" height="16" rx="3" fill={frameColor} stroke={accentPrimary} strokeWidth="1.5" />
            <line x1="145" y1="30" x2="155" y2="30" stroke={accentTertiary} strokeWidth="1.5" />
            <circle cx="162" cy="30" r="2" fill="#ef4444" />
          </g>
        );

      case "bike":
        return (
          <g transform="translate(10, 10)">
            {/* Heavy Flywheel */}
            <circle cx="65" cy="70" r="22" fill={frameColor} stroke={accentPrimary} strokeWidth="3" />
            <circle cx="65" cy="70" r="8" fill={metalLight} />
            {/* Bike Tubular Frame */}
            <path d="M65 70 L105 70 L135 40 L105 40 L90 70" stroke={metalLight} strokeWidth="4" strokeLinejoin="round" fill="none" />
            {/* Seat Post and Sadel */}
            <line x1="105" y1="70" x2="115" y2="35" stroke={metalDark} strokeWidth="4" />
            <path d="M102 35 Q115 30 130 35" stroke={padColor} strokeWidth="6" strokeLinecap="round" fill="none" />
            {/* Handlebars Post & Aero Bars */}
            <line x1="65" y1="70" x2="55" y2="35" stroke={metalDark} strokeWidth="4" />
            <path d="M48 30 Q58 24 72 32" stroke={accentTertiary} strokeWidth="3.5" strokeLinecap="round" fill="none" />
            {/* Crank & Pedals */}
            <circle cx="105" cy="70" r="5" fill={accentPrimary} />
            <line x1="105" y1="70" x2="112" y2="82" stroke={metalLight} strokeWidth="3" />
            <rect x="110" y="80" width="8" height="4" rx="1" fill={accentSecondary} />
          </g>
        );

      case "elliptical":
        return (
          <g transform="translate(10, 10)">
            {/* Rear Drive Flywheel Housing */}
            <circle cx="145" cy="68" r="20" fill={frameColor} stroke={accentPrimary} strokeWidth="2.5" />
            {/* Center Mast Frame */}
            <line x1="60" y1="88" x2="60" y2="30" stroke={frameColor} strokeWidth="5" strokeLinecap="round" />
            {/* Dual Dual-Action Tall Arm Poles */}
            <line x1="60" y1="35" x2="50" y2="15" stroke={accentTertiary} strokeWidth="4" strokeLinecap="round" />
            <line x1="60" y1="35" x2="72" y2="15" stroke={metalLight} strokeWidth="4" strokeLinecap="round" />
            {/* Gliding Foot Pedals */}
            <ellipse cx="95" cy="75" rx="16" ry="6" fill={padColor} stroke={accentSecondary} strokeWidth="1.5" />
            <ellipse cx="115" cy="65" rx="16" ry="6" fill={padColor} stroke={metalLight} strokeWidth="1.5" />
            {/* Base */}
            <line x1="30" y1="88" x2="170" y2="88" stroke={metalDark} strokeWidth="6" strokeLinecap="round" />
          </g>
        );

      case "rowing":
        return (
          <g transform="translate(10, 10)">
            {/* Long Monorail */}
            <line x1="30" y1="80" x2="175" y2="80" stroke={metalLight} strokeWidth="5" strokeLinecap="round" />
            {/* Front Damper / Flywheel Cage */}
            <circle cx="45" cy="62" r="18" fill={frameColor} stroke={accentPrimary} strokeWidth="3" />
            <circle cx="45" cy="62" r="5" fill={accentTertiary} />
            {/* Monitor Console */}
            <rect x="42" y="30" width="16" height="12" rx="2" fill={frameColor} stroke={accentSecondary} strokeWidth="1" />
            <line x1="45" y1="42" x2="45" y2="50" stroke={metalLight} strokeWidth="2" />
            {/* Footplates with Straps */}
            <rect x="75" y="60" width="8" height="20" rx="2" transform="rotate(25 75 60)" fill={metalDark} stroke={accentSecondary} strokeWidth="1" />
            {/* Sliding Ergometer Seat */}
            <rect x="130" y="70" width="22" height="10" rx="3" fill={padColor} stroke={accentPrimary} strokeWidth="2" />
            {/* Pull Handle Chain */}
            <line x1="55" y1="58" x2="105" y2="58" stroke={accentTertiary} strokeWidth="1.5" strokeDasharray="2 1" />
            <rect x="103" y="55" width="4" height="8" rx="1" fill={metalLight} />
          </g>
        );

      case "kettlebell":
        return (
          <g transform="translate(10, 10)">
            {/* Cast-Iron Wide Curved Handle */}
            <path d="M72 45 L72 32 Q72 18 100 18 Q128 18 128 32 L128 45" stroke={metalLight} strokeWidth="7" strokeLinecap="round" fill="none" />
            {/* Solid Iron Sphere Body */}
            <circle cx="100" cy="68" r="32" fill={frameColor} stroke={accentPrimary} strokeWidth="3" />
            {/* Weight Stamp Emboss & Flat Base */}
            <ellipse cx="100" cy="66" r="16" fill={metalDark} opacity="0.6" />
            <text x="100" y="70" textAnchor="middle" fill={accentTertiary} fontSize="9" fontWeight="900" fontFamily="sans-serif">
              16 KG
            </text>
            <line x1="82" y1="96" x2="118" y2="96" stroke={metalDark} strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="68" r="38" fill={accentPrimary} opacity="0.1" filter="blur(14px)" />
          </g>
        );

      case "band":
        return (
          <g transform="translate(10, 10)">
            {/* Loop Continuous Elastic Band */}
            <path d="M40 70 C40 30, 80 20, 100 45 C120 70, 160 60, 160 30 C160 15, 130 15, 100 35 C70 55, 40 85, 40 70 Z" 
              fill="none" stroke={accentPrimary} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M42 70 C42 32, 80 22, 100 47 C120 72, 158 62, 158 32" 
              fill="none" stroke={accentTertiary} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            {/* Tension Glow */}
            <circle cx="100" cy="50" r="35" fill={accentPrimary} opacity="0.15" filter="blur(16px)" />
          </g>
        );

      case "dip":
        return (
          <g transform="translate(10, 10)">
            {/* Heavy Base Feet */}
            <line x1="35" y1="95" x2="75" y2="95" stroke={metalDark} strokeWidth="5" strokeLinecap="round" />
            <line x1="125" y1="95" x2="165" y2="95" stroke={metalDark} strokeWidth="5" strokeLinecap="round" />
            {/* Dual Upright Steel Columns */}
            <path d="M55 95 L55 35 Q55 25 68 25 L88 25" stroke={frameColor} strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M145 95 L145 35 Q145 25 132 25 L112 25" stroke={frameColor} strokeWidth="6" strokeLinecap="round" fill="none" />
            {/* Padded Grips */}
            <line x1="68" y1="25" x2="95" y2="25" stroke={accentPrimary} strokeWidth="5" strokeLinecap="round" />
            <line x1="132" y1="25" x2="105" y2="25" stroke={accentPrimary} strokeWidth="5" strokeLinecap="round" />
          </g>
        );

      case "ab":
        return (
          <g transform="translate(10, 10)">
            {/* Weight Stack Tower */}
            <rect x="25" y="30" width="22" height="65" rx="2" fill={frameColor} stroke={metalDark} strokeWidth="1" />
            {/* Seat & Back Support */}
            <rect x="80" y="45" width="10" height="35" rx="2" fill={padColor} />
            <rect x="75" y="78" width="30" height="8" rx="2" fill={padColor} />
            {/* Overhead Curved Crunch Arm & Chest Roller */}
            <path d="M47 35 Q100 20 115 45" stroke={accentPrimary} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <circle cx="115" cy="45" r="8" fill={padColor} stroke={accentPrimary} strokeWidth="2.5" />
            {/* Foot Lock Rollers */}
            <circle cx="125" cy="85" r="6" fill={metalLight} />
            <circle cx="140" cy="85" r="6" fill={metalLight} />
          </g>
        );

      case "back":
        return (
          <g transform="translate(10, 10)">
            {/* 45 Degree Angle Frame */}
            <line x1="45" y1="90" x2="135" y2="35" stroke={frameColor} strokeWidth="8" strokeLinecap="round" />
            <line x1="45" y1="90" x2="155" y2="90" stroke={metalDark} strokeWidth="5" strokeLinecap="round" />
            {/* Hip Thigh Pads at Top */}
            <rect x="125" y="28" width="28" height="14" rx="3" transform="rotate(-40 125 28)" fill={padColor} stroke={accentPrimary} strokeWidth="2" />
            {/* Heel Roller Brackets at Bottom */}
            <circle cx="65" cy="82" r="7" fill={metalLight} stroke={accentTertiary} strokeWidth="2" />
            {/* Support Handle */}
            <path d="M125 45 L115 55" stroke={accentSecondary} strokeWidth="3" strokeLinecap="round" />
          </g>
        );

      case "rope":
        return (
          <g transform="translate(10, 10)">
            {/* Wall Anchor Ring */}
            <circle cx="25" cy="55" r="8" fill="none" stroke={metalLight} strokeWidth="3" />
            {/* Heavy Undulating Rope Waves */}
            <path d="M25 55 Q55 20 85 55 T145 55 L175 60" stroke={accentPrimary} strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M25 55 Q55 90 85 55 T145 55 L175 50" stroke={metalLight} strokeWidth="6" strokeLinecap="round" fill="none" />
            {/* Wrapped Grip Handles at Ends */}
            <rect x="165" y="46" width="15" height="7" rx="2" fill={accentTertiary} />
            <rect x="165" y="58" width="15" height="7" rx="2" fill={accentTertiary} />
          </g>
        );

      case "reardelt":
        return (
          <g transform="translate(10, 10)">
            {/* Tower Frame */}
            <rect x="88" y="15" width="24" height="85" rx="3" fill={frameColor} stroke={metalDark} strokeWidth="1" />
            {/* Seat facing inward to chest pad */}
            <rect x="85" y="75" width="30" height="8" rx="2" fill={padColor} />
            <rect x="94" y="42" width="12" height="30" rx="2" fill={padColor} stroke={metalLight} strokeWidth="1" />
            {/* Outward Wing Arms in Reverse Position */}
            <path d="M70 24 Q30 35 35 60" stroke={accentPrimary} strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M130 24 Q170 35 165 60" stroke={accentPrimary} strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="35" cy="60" r="5" fill={accentTertiary} />
            <circle cx="165" cy="60" r="5" fill={accentTertiary} />
          </g>
        );

      case "hip":
        return (
          <g transform="translate(10, 10)">
            {/* Weight Tower Front */}
            <rect x="88" y="20" width="24" height="78" rx="2" fill={frameColor} stroke={metalDark} strokeWidth="1" />
            {/* Seat */}
            <rect x="85" y="70" width="30" height="10" rx="2" fill={padColor} />
            {/* Swiveling Dual Leg Arms */}
            <path d="M85 75 L50 65" stroke={metalLight} strokeWidth="5" strokeLinecap="round" />
            <path d="M115 75 L150 65" stroke={metalLight} strokeWidth="5" strokeLinecap="round" />
            {/* Thigh Bolster Pads */}
            <rect x="42" y="55" width="14" height="20" rx="4" fill={padColor} stroke={accentPrimary} strokeWidth="2.5" />
            <rect x="144" y="55" width="14" height="20" rx="4" fill={padColor} stroke={accentPrimary} strokeWidth="2.5" />
          </g>
        );

      case "triceps":
        return (
          <g transform="translate(10, 10)">
            {/* High Pulley Top Beam */}
            <path d="M40 95 L40 18 Q40 12 50 12 L100 12" stroke={frameColor} strokeWidth="6" strokeLinecap="round" fill="none" />
            {/* Top Wheel */}
            <circle cx="100" cy="12" r="6" fill={metalLight} />
            {/* Drop Cable */}
            <line x1="100" y1="18" x2="100" y2="45" stroke={accentSecondary} strokeWidth="2" strokeDasharray="3 1" />
            {/* Braided Triceps Rope V-Shape */}
            <path d="M85 70 L100 45 L115 70" stroke={accentPrimary} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Rubber End Stoppers */}
            <circle cx="85" cy="70" r="5" fill={accentTertiary} />
            <circle cx="115" cy="70" r="5" fill={accentTertiary} />
          </g>
        );

      case "preacher":
        return (
          <g transform="translate(10, 10)">
            {/* Floor Base */}
            <line x1="45" y1="92" x2="155" y2="92" stroke={metalDark} strokeWidth="5" strokeLinecap="round" />
            {/* Armrest Slanted Preacher Pad */}
            <path d="M90 40 L135 55 L130 65 L85 50 Z" fill={padColor} stroke={accentPrimary} strokeWidth="2.5" />
            {/* Seat */}
            <rect x="50" y="65" width="28" height="8" rx="2" fill={padColor} />
            <line x1="64" y1="73" x2="64" y2="92" stroke={metalDark} strokeWidth="4" />
            {/* Barbell Cradle Rests */}
            <line x1="140" y1="52" x2="140" y2="80" stroke={metalLight} strokeWidth="4" />
            <path d="M136 52 Q144 52 144 45" stroke={accentTertiary} strokeWidth="3" fill="none" />
          </g>
        );

      default:
        return (
          <g transform="translate(10, 10)">
            <rect x="30" y="30" width="140" height="60" rx="8" fill={frameColor} stroke={accentPrimary} strokeWidth="2" />
            <circle cx="100" cy="60" r="20" fill={metalLight} opacity="0.3" />
          </g>
        );
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl flex items-center justify-center ${className}`}>
      {/* Background Spotlight Glow */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isDark
            ? "bg-gradient-to-br from-slate-900/90 via-[#0e121b] to-slate-950"
            : "bg-gradient-to-br from-slate-100 via-blue-50/50 to-slate-200"
        }`}
      />
      
      {/* Subtle Grid Accent Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
          backgroundSize: "16px 16px"
        }}
      />

      {/* SVG Canvas (Standard 220x120 viewBox) */}
      <svg
        className="relative z-10 w-full h-full max-h-48 drop-shadow-md select-none transition-transform duration-300 group-hover:scale-105"
        viewBox="0 0 220 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={name}
      >
        {renderIllustration()}
      </svg>
    </div>
  );
}
