/**
 * Site furniture that is a picture, addressed by name.
 *
 * WHAT A SLOT IS FOR
 * A slot is for an image that belongs to a PAGE rather than to a document —
 * something a template asks for by name, with no record of its own to hang
 * off. There is one of those left on this site: the still behind the
 * homepage's video hero, which is chosen on the hero block itself.
 *
 * WHAT SLOTS TURNED OUT TO BE WRONG FOR, and it is worth writing down because
 * the list here used to be thirteen entries rather than one.
 *
 * The six portfolio disciplines and the six services had a slot each —
 * `portfolio-<slug>` and `service-<slug>` — from a hardcoded list in this
 * file. That was defensible while both were arrays in a config module: the
 * structure was code, so a fixed list of slots matched the fixed list of
 * things.
 *
 * Then both became documents an editor can create, and the argument stopped
 * holding. A seventh service could be written, published and routed entirely
 * from the Studio, and then had nowhere to put a picture: no slot existed for
 * it, the page fell back to the flat tint with no warning on any screen, and
 * the fix was a code change here PLUS a Studio redeploy so the dropdown would
 * offer it. A CMS you have to deploy code to finish using is not one an
 * editor can actually rely on.
 *
 * So those twelve moved onto the documents they depict — `hero` on `service`,
 * `image` on `workCategory` — which is what `piece`, `post`, `caseStudy`,
 * `teamMember` and `client` already did. An image created with its subject is
 * deleted with its subject and cannot be orphaned by a slug rename, and the
 * Studio's "Images" list still shows them all in one place by listing those
 * document types, exactly as it already did for the other five.
 *
 * THE TEST, for anything considered for this list: does the image belong to a
 * document somebody can create? If yes it goes on that document. A slot is
 * only right when there is no such document — which is rarer than it looks.
 *
 * ADDING A SLOT: add it here, use `getArtwork('its-name')` where it renders,
 * and redeploy the Studio (`cd studio && npm run deploy`) so the dropdown
 * offers it. A slot nobody has uploaded to falls back to the colour
 * placeholder, so adding one is never a breaking change.
 */

export interface ImageSlot {
  /** Stable key. Changing it orphans whatever was uploaded against it. */
  name: string;
  /** How it reads in the Studio dropdown. */
  title: string;
  /** Which part of the site it belongs to — groups the dropdown. */
  group: 'Home';
}

export const IMAGE_SLOTS: ImageSlot[] = [
  { name: 'home-hero-poster', title: 'Home — hero still', group: 'Home' },
];

export const IMAGE_SLOT_NAMES = IMAGE_SLOTS.map((s) => s.name);
