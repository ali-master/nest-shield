# 🎨 NestJS Shield - Complete Brand Assets Guide

<p align="center">
  <img src="./logo.svg" alt="NestJS Shield Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Official brand assets, design guidelines, and usage standards</strong><br>
  <em>Everything you need to represent NestJS Shield consistently across all platforms</em>
</p>

---

## 📁 Available Assets

### 🏷️ Core Logo Assets

| Asset | Dimensions | Format | Usage | Features |
|-------|------------|--------|-------|----------|
| **`logo.svg`** | 200×200px | SVG | Main logo, app icons, profile pictures | Animated floating elements, modern gradients |
| **`logo.png`** | 512×512px | PNG | Fallback, legacy systems | High-resolution, transparent background |
| **`logo-compact.svg`** | 400×100px | SVG | Headers, navigation, horizontal layouts | Logo + text + feature pills |
| **`favicon.svg`** | 32×32px | SVG | Browser favicons, tab icons | Simplified design for small sizes |
| **`favicon.png`** | 32×32px | PNG | Legacy favicon support | Crisp at small sizes |

### 🌟 Marketing & Social Assets

| Asset | Dimensions | Format | Usage | Features |
|-------|------------|--------|-------|----------|
| **`social-preview.svg`** | 1280×640px | SVG | GitHub social preview, Open Graph | Complete brand presentation |
| **`social-preview.png`** | 1280×640px | PNG | Social media platforms | Optimized for sharing |

---

## 🎨 Brand Identity System

### 🌈 Color Palette

#### Primary Gradients

```css
/* Modern Gradient - Main Brand */
background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);

/* Accent Gradient - Tech Elements */
background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);

/* Dark Gradient - Premium Contrast */
background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
```

#### Individual Colors

| Color | Hex Code | RGB | Usage | Psychology |
|-------|----------|-----|-------|------------|
| **Primary Purple** | `#667eea` | `102, 126, 234` | Main brand, primary elements | Innovation, sophistication |
| **Deep Purple** | `#764ba2` | `118, 75, 162` | Secondary brand, depth | Professional, reliable |
| **Accent Pink** | `#f093fb` | `240, 147, 251` | Energy, highlights | Modern, vibrant |
| **Cyan Blue** | `#4facfe` | `79, 172, 254` | Tech accents, interactions | Fresh, technological |
| **Electric Teal** | `#00f2fe` | `0, 242, 254` | Alerts, active states | Dynamic, protective |
| **Dark Gray** | `#2d3748` | `45, 55, 72` | Text, contrast | Premium, elegant |
| **Neutral Gray** | `#64748b` | `100, 116, 139` | Secondary text | Professional, readable |

#### Color Usage Guidelines

- **Primary Gradient**: Main logo, hero sections, primary buttons
- **Accent Gradient**: Interactive elements, highlights, floating animations
- **Dark Gradient**: Backgrounds, shields, contrast elements
- **Individual Colors**: Text, borders, secondary elements

### ✍️ Typography System

#### Font Stack
```css
font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

#### Font Weights & Usage

| Weight | Value | Usage | Example |
|--------|-------|-------|---------|
| **Regular** | 400 | Body text, descriptions | Feature descriptions, documentation |
| **Medium** | 500 | Subheadings, captions | Feature subtitles, metadata |
| **Semibold** | 600 | Navigation, labels | Menu items, form labels |
| **Bold** | 700 | Headings, emphasis | Section headers, important text |
| **Extra Bold** | 800 | Hero titles, brand name | Main logo text, hero headlines |

#### Typography Scale

```css
/* Display */
.display-xl { font-size: 84px; font-weight: 800; } /* Hero titles */
.display-lg { font-size: 72px; font-weight: 700; } /* Page titles */
.display-md { font-size: 60px; font-weight: 700; } /* Section titles */

/* Headings */
.heading-xl { font-size: 48px; font-weight: 700; }
.heading-lg { font-size: 36px; font-weight: 700; }
.heading-md { font-size: 28px; font-weight: 600; }
.heading-sm { font-size: 24px; font-weight: 600; }

/* Body */
.body-xl { font-size: 20px; font-weight: 400; }
.body-lg { font-size: 18px; font-weight: 400; }
.body-md { font-size: 16px; font-weight: 400; }
.body-sm { font-size: 14px; font-weight: 400; }

/* Labels */
.label-lg { font-size: 16px; font-weight: 600; }
.label-md { font-size: 14px; font-weight: 600; }
.label-sm { font-size: 12px; font-weight: 600; }
```

---

## 📐 Logo Usage Guidelines

### ✅ Correct Usage

#### Sizing Requirements
- **Minimum Size**: 32px width for main logo, 48px width for compact version
- **Maximum Size**: No limit, SVG scales infinitely
- **Recommended Sizes**:
  - Social media profile: 400×400px
  - Documentation header: 200×50px
  - App icon: 512×512px
  - Favicon: 32×32px

#### Spacing & Clear Space
- **Clear Space**: Minimum 20px on all sides
- **Horizontal Spacing**: 1x logo width between logo and other elements
- **Vertical Spacing**: 0.5x logo height above and below

#### Background Compatibility
```css
/* Optimized for light backgrounds */
.logo-on-light { filter: none; }

/* Optimized for dark backgrounds */
.logo-on-dark { filter: brightness(1.1) contrast(1.05); }

/* High contrast mode */
.logo-high-contrast { filter: contrast(1.5) brightness(0.9); }
```

### ❌ Incorrect Usage

**Never do these:**
- ❌ Stretch, skew, or distort the logo proportions
- ❌ Change the colors or gradients
- ❌ Remove or modify the animation timings
- ❌ Place on busy backgrounds without sufficient contrast
- ❌ Rotate the logo (except 90° increments for specific layouts)
- ❌ Use low-resolution versions when high-res is available
- ❌ Combine with other logos without proper spacing

---

## 🎭 Design Principles

### Visual Identity Characteristics

#### Modern & Premium
- **Organic shield shapes** instead of rigid geometric forms
- **Smooth gradients** with multiple color stops
- **Subtle animations** for living brand personality
- **Premium color palette** inspired by modern SaaS products

#### Technical & Protective
- **Shield symbolism** represents protection and security
- **"N" letterform** connects to NestJS framework
- **Circuit-inspired elements** suggest technical sophistication
- **Floating animations** convey active monitoring

#### Professional & Approachable
- **Clean typography** ensures excellent readability
- **Balanced composition** works across all contexts
- **Consistent spacing** creates visual harmony
- **Scalable design** maintains quality at any size

---

## 📱 Platform-Specific Guidelines

### GitHub Repository
```html
<!-- README.md header -->
<p align="center">
  <img src="./assets/logo.svg" alt="NestJS Shield" width="120">
</p>

<!-- Social preview (auto-generated) -->
<!-- Uses: social-preview.svg (1280×640px) -->
```

### Social Media Platforms

#### Twitter/X
- **Profile Image**: `logo.png` (400×400px minimum)
- **Header Image**: `social-preview.png` (1500×500px)
- **Tweet Images**: `social-preview.png` (1200×675px)

#### LinkedIn
- **Company Logo**: `logo.png` (300×300px minimum)
- **Cover Photo**: `social-preview.png` (1192×220px)
- **Post Images**: `social-preview.png` (1200×630px)

#### Discord/Slack
- **Server Icon**: `logo.png` (512×512px)
- **Emojis**: `favicon.png` (32×32px)
- **Bot Avatar**: `logo.png` (256×256px)

### Documentation Sites

#### Docusaurus
```jsx
// docusaurus.config.js
module.exports = {
  themeConfig: {
    navbar: {
      logo: {
        alt: 'NestJS Shield',
        src: 'assets/logo-compact.svg',
        width: 200,
        height: 50,
      },
    },
  },
};
```

#### VitePress
```yaml
# .vitepress/config.js
export default {
  themeConfig: {
    logo: {
      light: '/assets/logo-compact.svg',
      dark: '/assets/logo-compact.svg'
    }
  }
}
```

---

## 🎨 Animation Guidelines

### SVG Animations
The logos include subtle CSS animations for modern web contexts:

```css
/* Floating elements animation */
@keyframes float {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* Different timing for organic feel */
.float-element-1 { animation: float 2s infinite; }
.float-element-2 { animation: float 1.5s infinite; }
.float-element-3 { animation: float 1.8s infinite; }
.float-element-4 { animation: float 2.2s infinite; }
```

#### Animation Usage Guidelines
- **Web interfaces**: Use animated SVG versions
- **Print materials**: Use static versions
- **Email**: Use PNG fallbacks (animations not supported)
- **Performance**: Consider `prefers-reduced-motion` media query

```css
@media (prefers-reduced-motion: reduce) {
  .logo-animated * {
    animation: none !important;
  }
}
```

---

## 🔧 Technical Specifications

### File Formats & Quality

#### SVG (Scalable Vector Graphics)
- **Benefits**: Infinite scalability, small file size, animation support
- **Usage**: Web, mobile apps, documentation, presentations
- **Browser Support**: IE9+, all modern browsers

#### PNG (Portable Network Graphics)
- **Benefits**: Wide compatibility, transparent backgrounds
- **Usage**: Legacy systems, email signatures, social media
- **Quality**: 32-bit color depth, alpha transparency

### Performance Optimization

#### SVG Optimization
```bash
# Using SVGO for optimization
npx svgo assets/logo.svg --config svgo.config.js

# Recommended SVGO config
module.exports = {
  plugins: [
    'removeDoctype',
    'removeComments',
    'cleanupNumericValues',
    'convertColors',
    'removeUselessStrokeAndFill',
    {
      name: 'removeViewBox',
      active: false
    }
  ]
}
```

#### Loading Best Practices
```html
<!-- Preload critical logos -->
<link rel="preload" href="/assets/logo.svg" as="image" type="image/svg+xml">

<!-- Lazy load non-critical images -->
<img src="/assets/social-preview.png" loading="lazy" alt="NestJS Shield">

<!-- Responsive images -->
<picture>
  <source media="(min-width: 1200px)" srcset="/assets/logo.svg">
  <source media="(min-width: 768px)" srcset="/assets/logo-compact.svg">
  <img src="/assets/favicon.svg" alt="NestJS Shield">
</picture>
```

---

## 📋 Asset Checklist

### For Developers
- [ ] Use SVG versions when possible for crisp rendering
- [ ] Implement proper fallbacks for legacy browsers
- [ ] Respect minimum size requirements
- [ ] Test logo visibility on different backgrounds
- [ ] Consider accessibility (alt text, contrast ratios)
- [ ] Optimize for performance (preload, lazy loading)

### For Designers
- [ ] Maintain consistent spacing and proportions
- [ ] Use official color palette
- [ ] Follow typography guidelines
- [ ] Ensure sufficient contrast ratios (WCAG AA compliance)
- [ ] Test across different devices and screen sizes
- [ ] Provide appropriate file formats for each use case

### For Marketers
- [ ] Use high-resolution assets for print materials
- [ ] Follow platform-specific guidelines
- [ ] Maintain brand consistency across channels
- [ ] Include proper attribution when required
- [ ] Test social media previews before publishing
- [ ] Keep local copies of all asset versions

---

## 🆘 Support & Resources

### Getting Help
- **Brand Guidelines Questions**: [Create an issue](https://github.com/ali-master/nest-shield/issues)
- **Asset Requests**: [Request new assets](https://github.com/ali-master/nest-shield/issues/new)
- **Custom Implementations**: Check our [examples repository](https://github.com/ali-master/nest-shield/tree/main/brand-examples)

### Additional Resources
- **Figma Community File**: [NestJS Shield Brand Kit](https://figma.com/@nestjs-shield) *(coming soon)*
- **Sketch Symbols**: [Download symbol library](./sketch-symbols.sketch) *(coming soon)*
- **Adobe Illustrator**: [Download AI templates](./brand-templates.ai) *(coming soon)*

### Brand Asset Updates
Assets are versioned alongside the main project. Check the [releases page](https://github.com/ali-master/nest-shield/releases) for updates.

---

## 📄 License & Usage Rights

### MIT License
These brand assets are available under the MIT License, consistent with the main project.

### Attribution Requirements
- **Required**: When using logos in derivative works or commercial contexts
- **Format**: "NestJS Shield logo used with permission"
- **Not Required**: In documentation, tutorials, or educational content about the project

### Commercial Usage
- ✅ **Allowed**: Blog posts, tutorials, presentations about NestJS Shield
- ✅ **Allowed**: Integration documentation and case studies
- ✅ **Allowed**: Conference talks and educational materials
- ❌ **Prohibited**: Implying official endorsement without permission
- ❌ **Prohibited**: Using as your own brand or in competing products

---

<div align="center">

**Questions about brand asset usage?**

[📧 Contact the maintainers](mailto:brand@nestjs-shield.com) • [💬 Join our Discord](https://discord.gg/nestshield) • [📝 Create an issue](https://github.com/ali-master/nest-shield/issues)

---

<sub>This brand guide is a living document. Last updated: December 2024</sub>

</div>