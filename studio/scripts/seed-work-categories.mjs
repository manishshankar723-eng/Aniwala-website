/**
 * The portfolio disciplines, as they stood before they moved to the CMS.
 *
 * `services` is kept as slugs here; the migration turns each into a reference
 * to the matching service document.
 */
export const WORK_CATEGORIES = [
  {
    "slug": "character-design",
    "title": "Character Design",
    "shortName": "character design",
    "blurb": "Concept through to production-ready rigs",
    "intro": "Silhouette and personality first, then the technical work that keeps them intact — topology that deforms, a rig an animator can actually drive, and a face that holds up in close-up.",
    "tint": "210 70% 22%",
    "wide": true,
    "order": 10,
    "services": [
      "3d-art",
      "2d-art",
      "animation"
    ]
  },
  {
    "slug": "environments",
    "title": "Environments & Props",
    "shortName": "environments and props",
    "blurb": "Worlds, set dressing and hero assets",
    "intro": "Modular kits, hero assets and the dressing between them, built to a stated budget and a uniform texel density rather than to whatever the viewport tolerated on the day.",
    "tint": "150 45% 20%",
    "wide": false,
    "order": 20,
    "services": [
      "3d-art",
      "integration"
    ]
  },
  {
    "slug": "animation",
    "title": "Animation",
    "shortName": "animation",
    "blurb": "2D and 3D performance, gameplay and cinematic",
    "intro": "Performance, gameplay loops and cinematic staging — in 2D, 3D or the hybrid of the two we use when a drawn face has to carry a rigged body.",
    "tint": "28 75% 26%",
    "wide": false,
    "order": 30,
    "services": [
      "animation",
      "video-editing"
    ]
  },
  {
    "slug": "vfx",
    "title": "VFX",
    "shortName": "VFX",
    "blurb": "Simulation, compositing and finishing",
    "intro": "Simulation, compositing and the finishing that makes it sit in the plate. We're as interested in which shots don't need a full sim as in the ones that do.",
    "tint": "280 50% 26%",
    "wide": true,
    "order": 40,
    "services": [
      "vfx",
      "integration"
    ]
  },
  {
    "slug": "concept-art",
    "title": "Concept & 2D Art",
    "shortName": "concept and 2D art",
    "blurb": "Visual development, key art and storyboards",
    "intro": "Visual development, key art, storyboards and the style frames that settle a look while changing it is still cheap.",
    "tint": "340 55% 24%",
    "wide": false,
    "order": 50,
    "services": [
      "2d-art"
    ]
  },
  {
    "slug": "motion-graphics",
    "title": "Motion Graphics",
    "shortName": "motion graphics",
    "blurb": "Titles, explainers and broadcast design",
    "intro": "Titles, explainers, broadcast packages and the cutdowns that come after — designed to survive being resized for six placements.",
    "tint": "195 60% 24%",
    "wide": false,
    "order": 60,
    "services": [
      "video-editing",
      "vfx"
    ]
  }
];
