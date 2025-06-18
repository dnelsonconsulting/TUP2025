npx create-next-app@latest --typescript transcript-uploader
cd transcript-uploader

# Install Tailwind CSS, PostCSS, Autoprefixer
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install Headless UI and Heroicons (best for modals, dropdowns, etc)
npm install @headlessui/react @heroicons/react

# Add React Hook Form for easy validation
npm install react-hook-form

# Zod for type-safe schema validation (optional but highly recommended)
npm install zod @hookform/resolvers

# For beautiful country dropdowns
npm install react-select country-list

# For file previews, modals, and UI polish
npm install @radix-ui/react-dialog @radix-ui/react-tooltip

# For notifications/toasts
npm install sonner # or "react-hot-toast"
