// Jump back to the top when switching tabs (sections are shown with :target).
addEventListener('hashchange', () => scrollTo(0, 0));
addEventListener('load', () => scrollTo(0, 0));
