/**
 * Site navigation. Header and mobile drawer both read this, so a link
 * never has to be added in two places.
 */
export interface NavChild {
  label: string;
  href: string;
  /** Optional one-liner shown under the label in the dropdown. */
  blurb?: string;
}

export interface NavItem {
  label: string;
  href?: string;
  children?: NavChild[];
}

export const nav: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Portfolio', href: '/portfolio/' },
  {
    label: 'Services',
    children: [
      {
        label: '2D Animation',
        href: '/services/2d-animation/',
        blurb: 'Frame-by-frame and rigged character work',
      },
      {
        label: '3D Animation',
        href: '/services/3d-animation/',
        blurb: 'Cinematics, character and creature performance',
      },
      { label: 'VFX', href: '/services/vfx/', blurb: 'Simulation, compositing and finishing' },
      {
        label: 'Game Art',
        href: '/services/game-art/',
        blurb: 'Concept, environment and asset production',
      },
      {
        label: 'Motion Graphics',
        href: '/services/motion-graphics/',
        blurb: 'Titles, explainers and broadcast design',
      },
    ],
  },
  { label: 'About Us', href: '/about/' },
  { label: 'Blog', href: '/blog/' },
  { label: 'Contact', href: '/contact/' },
];

/**
 * The slim strip above the header.
 *
 * `id` versions the dismissal: bump it and the bar returns for people who
 * dismissed the previous one, instead of staying hidden forever.
 */
export const announce = {
  enabled: true,
  id: 'ai-animation-2026',
  text: 'AI + Animation — faster iteration, same hand-finished craft.',
  cta: 'See how we use it',
  href: '/ai-animation/',
};

/** The gold call-to-action button at the end of the header. */
export const cta = { label: 'Book Appointment', href: '/contact/' };

/**
 * What the search overlay looks through until there is real content.
 * Once blog and portfolio pages exist, swap this for a build-time index
 * (Pagefind indexes the built HTML and needs no hand maintenance).
 */
export interface SearchDoc {
  title: string;
  href: string;
  section: string;
  keywords: string;
}

export const searchIndex: SearchDoc[] = [
  { title: 'Home', href: '/', section: 'Pages', keywords: 'aniwala studios animation showreel' },
  {
    title: 'Portfolio',
    href: '/portfolio/',
    section: 'Pages',
    keywords: 'work projects case studies reel',
  },
  { title: 'About Us', href: '/about/', section: 'Pages', keywords: 'studio team story pipeline' },
  { title: 'Blog', href: '/blog/', section: 'Pages', keywords: 'journal news breakdowns articles' },
  {
    title: 'Contact',
    href: '/contact/',
    section: 'Pages',
    keywords: 'book appointment enquiry email hire quote',
  },
  {
    title: '2D Animation',
    href: '/services/2d-animation/',
    section: 'Services',
    keywords: 'traditional frame by frame rigged character cutout',
  },
  {
    title: '3D Animation',
    href: '/services/3d-animation/',
    section: 'Services',
    keywords: 'cgi cinematic maya blender character creature',
  },
  {
    title: 'VFX',
    href: '/services/vfx/',
    section: 'Services',
    keywords: 'visual effects simulation compositing houdini nuke',
  },
  {
    title: 'Game Art',
    href: '/services/game-art/',
    section: 'Services',
    keywords: 'concept environment props assets unreal unity',
  },
  {
    title: 'Motion Graphics',
    href: '/services/motion-graphics/',
    section: 'Services',
    keywords: 'titles explainer broadcast after effects design',
  },
];
