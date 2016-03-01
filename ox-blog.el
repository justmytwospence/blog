;; https://github.com/justmytwospence/emacs/blob/master/package-setup.el
(require 'package-setup (expand-file-name "package-setup.el" user-emacs-directory))
(require 'base16-tomorrow-dark-theme)
(require 'ht)
(require 'htmlize)
(require 'mustache)
(require 'ox-html)
(require 'ox-latex)
(require 'ox-publish)
(require 'ox-reveal)
(require 'ox-rss)
(require 'ox-twbs)

;; pretty urls
(add-hook 'org-publish-after-publishing-hook
          (defun prettify-url (src-filename published-filename)
            (if (and (s-ends-with? ".html" published-filename)
                     (not (s-ends-with? "index.html" published-filename))
                     (not (s-ends-with? "static/html/" (file-name-directory src-filename))))
                (let ((filename (s-chop-suffix ".html" published-filename)))
                  (mkdir filename t)
                  (rename-file published-filename (concat filename "/index.html") t)))))

;; generic export settings
(setq org-export-dispatch-use-expert-ui t
      org-export-with-section-numbers nil
      org-export-with-toc nil
      org-publish-use-timestamps-flag nil)

;; ox-reveal settings
(setq org-reveal-root "~/blog/vendor/reveal.js"
      org-reveal-single-file t
      org-reveal-theme "solarized"
      org-reveal-transition "slide")

;; twbs settings
(setq org-twbs-head-include-default-style nil
      org-twbs-head-include-scripts nil
      org-twbs-mathjax-options
      '((path "https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_HTML")
        (scale "100")
        (dscale "100")
        (align "center")
        (indent "0em")
        (messages "none")))

;; templating

(defun include (template context)
  (mustache-render
   (with-temp-buffer
     (insert-file-contents template)
     (buffer-string))
   context))

(setq blog (expand-file-name "~/blog/")
      site-url "http://spencerboucher.com"
      context (ht ("disqus-user" "spencerboucher")
                  ("email" user-mail-address)
                  ("github-repo" "blog")
                  ("github-user" "justmytwospence")
                  ("google-analytics-id" "UA-45101202-1")
                  ("name" user-full-name)
                  ("site-url" site-url)
                  ("url-encode"
                   (lambda (template context)
                     (url-encode-url (mustache-render template context)))))
      head (include (concat blog "templates/head.mustache") context)
      postamble (concat blog "templates/postamble.mustache")
      preamble (concat blog "templates/preamble.mustache"))

;; publishing
(setq org-publish-project-alist
      (append org-publish-project-alist
              `(("blog"
                 ;; the order of the components is important
                 :components ("static" "posts" "slides" "pages"))

                ("pages"
                 :base-directory ,(concat blog "pages")
                 :html-head ,head
                 :html-head-include-default-style nil
                 :html-head-include-scripts nil
                 :html-postamble
                 (lambda (info)
                   (let ((context (ht-merge context (ht ("is-post" nil)))))
                     (include postamble context)))
                 :html-preamble
                 (lambda (info)
                   (let* ((title (car (plist-get info :title)))
                          (switch (downcase (concat title "-active")))
                          (context (ht-merge context (ht (switch t)))))
                     (include preamble context)))
                 :section-numbers nil
                 :publishing-directory ,(concat blog "public")
                 :publishing-function org-twbs-publish-to-html
                 :with-title nil
                 :with-toc nil)

                ("posts"
                 :auto-sitemap t
                 :base-directory ,(concat blog "posts")
                 :html-head ,head
                 :html-head-include-default-style nil
                 :html-head-include-scripts nil
                 :html-postamble
                 (lambda (info)
                   (let* ((filename (s-chop-prefix "./" (org-export-output-file-name "")))
                          (title (car (plist-get info :title)))
                          (is-post (not (string= title "Posts")))
                          (context (ht-merge context (ht ("filename" filename)
                                                         ("is-post" is-post)
                                                         ("title" title)))))
                     (include postamble context)))
                 :html-preamble
                 (lambda (info)
                   (let ((context (ht-merge context (ht ("posts-active" t)))))
                     (include preamble context)))
                 :publishing-directory ,(concat blog "public")
                 :publishing-function org-twbs-publish-to-html
                 :section-numbers nil
                 :sitemap-file-entry-format "%d: %t"
                 :sitemap-filename "index.org"
                 :sitemap-sans-extension t
                 :sitemap-sort-files anti-chronologically
                 :sitemap-title "Posts"
                 :with-date t
                 :with-toc nil)

                ("slides"
                 :auto-sitemap t
                 :base-directory ,(concat blog "slides")
                 :html-head ,head
                 :publishing-directory ,(concat blog "public/slides")
                 :publishing-function org-reveal-publish-to-reveal
                 :sitemap-file-entry-format "%t"
                 ;; sitemap needs to be sent to pages so it doesn't render as slides
                 :sitemap-filename "../pages/slides.org"
                 :sitemap-sans-extension t
                 :sitemap-title "Slides")

                ("static"
                 :base-directory ,(concat blog "static")
                 ;; copy over fonts, images, and html
                 :base-extension ,(rx (or "eott" "gif" "html" "ico" "pdf" "png" "svg"
                                          (regexp "jpe?g")
                                          (regexp "woff2?")))
                 :completion-function
                 (lambda ()
                   "CSS and JS are combined and minified by the Makefile."
                   (let ((default-directory blog))
                     (message "Compiling assets...")
                     (compile "make")))
                 :publishing-directory ,(concat blog "public/static")
                 :publishing-function org-publish-attachment
                 :recursive t))))

(provide 'ox-blog)
