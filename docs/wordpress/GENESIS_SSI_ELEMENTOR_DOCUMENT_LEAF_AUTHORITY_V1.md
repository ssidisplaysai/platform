# Genesis SSI Elementor Document Leaf Authority v1

The supported save path is Elementor's document API:

```php
$document = \Elementor\Plugin::$instance->documents->get($page_id);
$tree = $document->get_elements_data();
$document->save(array('elements' => $tree));
```

`Document::save()` executes Elementor save filters and hooks, serializes editor data, deletes the post CSS file, and deletes the document render cache. V1 does not write `_elementor_data` directly.

The endpoint is hard-bound to `projectorenclosure.com`, page 3810, four approved HTML widget IDs, and the `settings.html` leaf. It requires `edit_others_pages`, exact `edit_post`, and `unfiltered_html` so Elementor does not KSES existing HTML-widget style content. It also requires document and leaf SHA-256 compare-and-set values and validates the complete hierarchy plus all non-target HTML leaves after save.

Installation requires an administrator with Code Snippets management authority. The certified application-password identity is an editor with page-edit and `unfiltered_html` capabilities, but cannot install snippets.

## Future Multi-Leaf Contract

A future atomic request may contain one expected document hash and exactly one expected hash/replacement for each requested member of this allowlist:

- `98e1f56/settings.html`
- `0ce76cb/settings.html`
- `e87d71c/settings.html`
- `94e8256/settings.html`

The server must validate every page, element, widget, leaf, document hash, and leaf hash before changing memory. It must then perform one `Document::save(['elements' => $tree])`, compare the complete parsed hierarchy, require all non-target leaves unchanged, and retain the exact pre-save `_elementor_data` and post_content snapshot for rollback through the same document save pathway.

## Certification

Install the snippet, then use widget `98e1f56` with one inert HTML comment marker. Record exact Elementor and post_content hashes before/after. Verify REST rendered content and public `/`, invoke the existing Elementor files authority if needed, then restore through the same endpoint. Exact original document and post_content hashes are mandatory.