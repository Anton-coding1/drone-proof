<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Site chrome (Header, Footer, nav data, Photo, StatusPill) lives in src/components/site; nav links come from site/nav.ts so menus, mobile menu and command palette stay in sync.
- Pages with a full-bleed photo top section must be listed in PHOTO_HEADER_PATHS in Header.tsx; others get a 64px spacer.
- Photos are hotlinked Unsplash only via src/lib/photos.ts, always with a PhotoCredit.
