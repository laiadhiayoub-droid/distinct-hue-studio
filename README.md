# Radiant Canvas

Use the following design philosophy for this project:

<frontend_aesthetics>

Before writing any code, define a bold aesthetic direction by answering:

1. What problem does this interface solve, and for whom?

2. What tone defines it? Choose one and fully commit: brutally minimal, maximalist, retro-futuristic, editorial, brutalist, art deco, organic, luxury, or playful.

3. What is the one thing users will remember most about this design?

Then implement the interface with strong visual intention. Match implementation complexity to the vision: maximalist design should include elaborate animations and layered effects, while refined minimalism should rely on precise spacing, typography, and subtle detail.

Design rules:

- Typography: Use distinctive, characterful fonts. Pair a unique display font with a refined body font. Avoid Inter, Roboto, Arial, Space Grotesk, and generic system fonts.

- Color & Theme: Commit to one dominant palette with sharp accents. Use CSS variables for consistency. Avoid safe, evenly distributed palettes. Take inspiration from IDE themes and cultural aesthetics.

- Motion: Focus on memorable, high-impact motion. A strong page-load reveal with staggered animations is better than many weak hover effects. Use CSS-only motion for HTML and Motion library for React.

- Spatial Composition: Break rigid layouts. Use asymmetry, overlap, diagonal flow, generous negative space, or controlled density. Avoid default centered stacks.

- Backgrounds & Texture: Add atmosphere using gradient meshes, noise, geometric patterns, layered transparency, grain, dramatic shadows, and decorative borders. Do not default to flat solid backgrounds unless the chosen aesthetic requires it.

Never use:

- Overused fonts like Inter, Roboto, Arial, Space Grotesk, or system defaults

- Generic color schemes, especially purple gradients on white

- Predictable centered layouts, standard card grids, or reusable-looking patterns

- Cookie-cutter design with no context-specific identity

Make bold, unexpected choices that feel tailored to this exact project. The final result should feel unique, memorable, and impossible to confuse with a generic template.

</frontend_aesthetics>

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://distinct-hue-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e6d3b7df-f720-4358-9abd-e5873a7cd3fe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
