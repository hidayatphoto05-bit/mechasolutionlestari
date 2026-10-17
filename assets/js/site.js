/* Mesin render website: menerapkan konfigurasi (default + simpanan localStorage)
   ke seluruh halaman, serta menerima config live dari Studio Kustomisasi via postMessage. */
(function () {
  'use strict';

  var STORAGE_KEY = window.MSL.STORAGE_KEY;
  var deepMerge = window.MSL.deepMerge;
  var currentWa = '';
  var currentBrand = '';
  var aboutTimer = null;

  function loadSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function currentConfig() {
    return deepMerge(window.MSL_DEFAULT, loadSaved());
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function icon(name) {
    var body = window.MSL_ICONS[name] || window.MSL_ICONS.check;
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }

  /* Bangun atribut style="…" dari pasangan {prop: nilai}; lewati nilai kosong. */
  function st(pairs) {
    var s = '';
    for (var k in pairs) {
      if (pairs[k]) s += k + ':' + pairs[k] + ';';
    }
    return s ? ' style="' + s + '"' : '';
  }

  /* Terapkan satu warna ke properti style pada elemen; hapus bila nilai kosong. */
  function paint(sel, prop, color) {
    var el = document.querySelector(sel);
    if (!el) return;
    if (color) el.style.setProperty(prop, color);
    else el.style.removeProperty(prop);
  }

  /* Terapkan warna ke banyak elemen sekaligus (prop sama). */
  function paintAll(sel, prop, color) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      if (color) els[i].style.setProperty(prop, color);
      else els[i].style.removeProperty(prop);
    }
  }

  function setText(sel, value) {
    var el = document.querySelector(sel);
    if (el) el.textContent = value == null ? '' : value;
  }

  function setHTML(sel, value) {
    var el = document.querySelector(sel);
    if (el) el.innerHTML = value == null ? '' : value;
  }

  function hexToRgbTriplet(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '15, 23, 42';
    var n = parseInt(m[1], 16);
    return ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255);
  }

  function gradientCss(g) {
    if (!g || !g.enabled) return '';
    var angle = g.angle == null ? 135 : g.angle;
    return 'linear-gradient(' + angle + 'deg, ' + (g.from || '#ffffff') + ', ' + (g.to || '#000000') + ')';
  }

  function applyTheme(t) {
    var r = document.documentElement.style;
    r.setProperty('--primary', t.primary);
    r.setProperty('--primary-dark', t.primaryDark);
    r.setProperty('--accent', t.accent);
    r.setProperty('--dark', t.dark);
    r.setProperty('--bg', t.bg);
    r.setProperty('--surface', t.surface);
    r.setProperty('--text', t.text);
    r.setProperty('--muted', t.muted);
    r.setProperty('--border', t.border);
    r.setProperty('--radius', (parseFloat(t.radius) || 14) + 'px');
    r.setProperty('--font-heading', "'" + t.fontHeading + "', sans-serif");
    r.setProperty('--font-body', "'" + t.fontBody + "', sans-serif");
    r.setProperty('--shadow-rgb', hexToRgbTriplet(t.shadowColor));
    r.setProperty('--shadow-alpha', String((t.shadowOpacity == null ? 12 : t.shadowOpacity) / 100));
    r.setProperty('--shadow-blur', (parseFloat(t.shadowBlur) == null || isNaN(parseFloat(t.shadowBlur)) ? 40 : parseFloat(t.shadowBlur)) + 'px');
    r.setProperty('--card-gradient', gradientCss(t.cardGradient) || 'none');
    r.setProperty('--btn-gradient', gradientCss(t.btnGradient) || 'none');
    var bo = t.boxOutline || {};
    var boOn = bo.enabled !== false;
    r.setProperty('--box-bw', boOn ? ((parseFloat(bo.width) || 1) + 'px') : '0px');
    r.setProperty('--box-bc', boOn ? (bo.color || 'var(--border)') : 'transparent');
    r.setProperty('--box-radius', (t.boxRadius === '' || t.boxRadius == null) ? 'var(--radius)' : (parseFloat(t.boxRadius) + 'px'));

    var fams = [t.fontHeading, t.fontBody].filter(function (f, i, a) { return a.indexOf(f) === i; });
    var href = 'https://fonts.googleapis.com/css2?' + fams.map(function (f) {
      return 'family=' + encodeURIComponent(f) + ':wght@400;500;600;700;800';
    }).join('&') + '&display=swap';
    var link = document.getElementById('msl-fonts');
    if (!link) {
      link = document.createElement('link');
      link.id = 'msl-fonts';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }

  function sectionBg(el, value) {
    if (!el) return;
    if (value) {
      el.setAttribute('data-bg', 'custom');
      el.style.setProperty('--section-bg', value);
    } else {
      el.removeAttribute('data-bg');
      el.style.removeProperty('--section-bg');
    }
  }

  function show(el, visible) {
    if (el) el.style.display = visible ? '' : 'none';
  }

  function setLogo(sel, brand) {
    var el = document.querySelector(sel);
    if (!el) return;
    if (brand.logoImage) {
      el.innerHTML = '<img src="' + String(brand.logoImage).replace(/"/g, '&quot;') + '" alt="" />';
    } else {
      el.textContent = brand.logoMark;
    }
  }

  function applyGradient(el, sec) {
    if (!el || !sec) return;
    var css = gradientCss(sec.gradient);
    if (css) el.style.backgroundImage = css;
    else el.style.backgroundImage = '';
  }

  function applyBgImage(el, sec) {
    if (!el || !sec) return;
    var layer = null;
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].classList && el.children[i].classList.contains('bg-img')) { layer = el.children[i]; break; }
    }
    if (!sec.image) { if (layer) layer.remove(); return; }
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'bg-img';
      el.insertBefore(layer, el.firstChild);
    }
    layer.style.backgroundImage = "url('" + sec.image + "')";
    layer.style.opacity = String((sec.imageOpacity == null ? 12 : sec.imageOpacity) / 100);
  }

  function initials(name) {
    return String(name || '').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase();
  }

  /* Kartu ikon seragam untuk bagian Layanan & Keunggulan: warna kotak, ikon, judul, dan teks
     dapat ditimpa per bagian lewat Studio Kustomisasi. */
  function iconCard(sec, it) {
    var cardBg = it.cardBg || sec.cardBg;
    var iconBg = it.iconBg || sec.iconBg;
    var iconColor = it.iconColor || sec.iconColor;
    var grad = (!cardBg && sec.cardGradient && sec.cardGradient.enabled) ? gradientCss(sec.cardGradient) : '';
    var cardStyle = cardBg ? { background: cardBg } : (grad ? { 'background-image': grad } : {});
    return '<article class="card"' + st(cardStyle) + '>' +
      '<div class="card-icon"' + st({ background: iconBg, color: iconColor }) + '>' + icon(it.icon) + '</div>' +
      '<h3' + st({ color: sec.titleColor }) + '>' + esc(it.title) + '</h3>' +
      '<p' + st({ color: sec.textColor }) + '>' + esc(it.desc) + '</p></article>';
  }

  function renderMap(contact) {
    var box = document.getElementById('contact-map');
    if (!box) return;
    var on = contact.mapVisible !== false;
    show(box, on);
    if (!on) return;
    var addr = contact.mapAddress || contact.address || '';
    var q = encodeURIComponent(addr);
    var embed = 'https://www.google.com/maps?q=' + q + '&output=embed';
    var frame = box.querySelector('iframe');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = 'Peta lokasi kantor';
      frame.setAttribute('loading', 'lazy');
      frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      box.appendChild(frame);
      var bar = document.createElement('div');
      bar.className = 'map-bar';
      bar.innerHTML = '<span id="map-address"></span>' +
        '<a id="map-open" href="#" target="_blank" rel="noopener">Buka di Google Maps &#8599;</a>';
      box.appendChild(bar);
    }
    if (frame.getAttribute('src') !== embed) frame.setAttribute('src', embed);
    box.style.setProperty('--map-h', (parseInt(contact.mapHeight, 10) || 380) + 'px');
    var w = parseInt(contact.mapWidth, 10);
    if (w > 0 && w < 100) {
      box.style.maxWidth = w + '%';
      var align = contact.mapAlign || 'tengah';
      box.style.marginLeft = align === 'kiri' ? '0' : 'auto';
      box.style.marginRight = align === 'kanan' ? '0' : 'auto';
    } else {
      box.style.removeProperty('max-width');
      box.style.removeProperty('margin-left');
      box.style.removeProperty('margin-right');
    }
    setText('#map-address', addr);
    var open = document.getElementById('map-open');
    if (open) open.href = 'https://www.google.com/maps/search/?api=1&query=' + q;
  }

  function aboutImages(about) {
    var list = (about.images || []).map(function (it) {
      return (typeof it === 'string') ? { url: it, alt: '' } : { url: it && it.url, alt: (it && it.alt) || '' };
    }).filter(function (it) { return !!it.url; });
    if (!list.length && about.image) list = [{ url: about.image, alt: '' }];
    return list;
  }
  function aboutHasImage(about) { return aboutImages(about).length > 0; }

  function renderAboutSlider(about) {
    var box = document.getElementById('about-slider');
    if (!box) return;
    if (aboutTimer) { clearInterval(aboutTimer); aboutTimer = null; }
    var imgs = aboutImages(about);
    if (!imgs.length) { box.innerHTML = ''; return; }
    var multi = imgs.length > 1;
    box.innerHTML =
      '<div class="about-slides">' + imgs.map(function (im, i) {
        return '<img class="about-slide' + (i === 0 ? ' active' : '') + '" src="' + String(im.url).replace(/"/g, '&quot;') + '" alt="' + esc(im.alt || 'Tentang CV. Mecha Solution Lestari') + '" />';
      }).join('') + '</div>' +
      (multi
        ? '<button type="button" class="about-nav prev" aria-label="Gambar sebelumnya">&#8249;</button>' +
          '<button type="button" class="about-nav next" aria-label="Gambar berikutnya">&#8250;</button>' +
          '<div class="about-dots">' + imgs.map(function (_, i) {
            return '<button type="button" class="about-dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '" aria-label="Gambar ' + (i + 1) + '"></button>';
          }).join('') + '</div>'
        : '');
    if (!multi) return;
    var slides = box.querySelectorAll('.about-slide');
    var dots = box.querySelectorAll('.about-dot');
    var idx = 0;
    function go(n) {
      idx = (n + slides.length) % slides.length;
      for (var i = 0; i < slides.length; i++) {
        slides[i].classList.toggle('active', i === idx);
        if (dots[i]) dots[i].classList.toggle('active', i === idx);
      }
    }
    function restart() {
      if (aboutTimer) { clearInterval(aboutTimer); aboutTimer = null; }
      if (about.sliderAuto !== false) {
        var ms = (parseInt(about.sliderInterval, 10) || 4) * 1000;
        aboutTimer = setInterval(function () { go(idx + 1); }, ms);
      }
    }
    box.querySelector('.about-nav.prev').addEventListener('click', function () { go(idx - 1); restart(); });
    box.querySelector('.about-nav.next').addEventListener('click', function () { go(idx + 1); restart(); });
    for (var d = 0; d < dots.length; d++) {
      dots[d].addEventListener('click', function () { go(parseInt(this.getAttribute('data-i'), 10)); restart(); });
    }
    box.addEventListener('mouseenter', function () { if (aboutTimer) { clearInterval(aboutTimer); aboutTimer = null; } });
    box.addEventListener('mouseleave', restart);
    restart();
  }

  function render(cfg) {
    applyTheme(cfg.theme);

    // Brand
    setText('#brand-name', cfg.brand.short);
    setText('#brand-mark', cfg.brand.logoMark);
    setText('#footer-brand-name', cfg.brand.short);
    setText('#footer-brand-mark', cfg.brand.logoMark);
    setLogo('#brand-mark', cfg.brand);
    setLogo('#footer-brand-mark', cfg.brand);
    var logoBgCss = 'linear-gradient(135deg, ' + (cfg.brand.logoBg || '#1D4ED8') + ', ' + (cfg.brand.logoBg2 || '#06B6D4') + ')';
    var mark1 = document.querySelector('#brand-mark');
    var mark2 = document.querySelector('#footer-brand-mark');
    if (mark1) mark1.style.background = logoBgCss;
    if (mark2) mark2.style.background = logoBgCss;
    paint('.nav .brand', 'color', cfg.brand.textColor);
    paint('.nav .brand small', 'color', cfg.brand.textColor);
    document.title = cfg.brand.name + ' — General Supplier Elektronik & Jasa IT';

    // Hero
    var hero = document.getElementById('hero');
    show(hero, cfg.hero.visible !== false);
    sectionBg(hero, cfg.hero.bg);
    setText('#hero-badge', cfg.hero.badge);
    setText('#hero-title', cfg.hero.title);
    setHTML('#hero-tagline', esc(cfg.hero.tagline));
    setText('#hero-desc', cfg.hero.desc);
    setText('#hero-cta-primary', cfg.hero.ctaPrimary);
    setText('#hero-cta-secondary', cfg.hero.ctaSecondary);
    paint('#hero-title', 'color', cfg.hero.titleColor);
    paint('#hero-tagline', 'color', cfg.hero.titleColor);
    paint('#hero-desc', 'color', cfg.hero.textColor);
    paint('#hero-badge', 'color', cfg.hero.textColor);
    var heroImg = document.getElementById('hero-img');
    if (heroImg) {
      heroImg.style.backgroundImage = cfg.hero.image ? "url('" + cfg.hero.image + "')" : 'none';
      heroImg.style.opacity = String((cfg.hero.imageOpacity == null ? 22 : cfg.hero.imageOpacity) / 100);
    }
    var heroImgEl = document.getElementById('hero-photo');
    if (heroImgEl) {
      var showPhoto = cfg.hero.showPhoto !== false && !!cfg.hero.photo;
      heroImgEl.style.display = showPhoto ? '' : 'none';
      if (showPhoto) heroImgEl.src = cfg.hero.photo;
    }
    setHTML('#hero-services', (cfg.hero.showServiceList === false ? [] : (cfg.hero.services || [])).map(function (s) {
      return '<li' + st({ color: cfg.hero.textColor }) + '>' + esc(s) + '</li>';
    }).join(''));
    show(document.getElementById('hero-services'), cfg.hero.showServiceList !== false);

    // Kartu mengambang di hero
    var heroCard = document.getElementById('hero-card');
    show(heroCard, cfg.hero.cardVisible !== false);
    setText('#hero-card-title', cfg.hero.cardTitle);
    setText('#hero-card-sub', cfg.hero.cardSub);
    if (heroCard) {
      heroCard.style.background = cfg.hero.cardBg || '#FFFFFF';
      heroCard.style.color = cfg.hero.cardFg || '#0F172A';
    }
    var cardSlot = document.getElementById('hero-card-iconslot');
    if (cardSlot) {
      cardSlot.innerHTML = cfg.hero.cardImage
        ? '<img src="' + String(cfg.hero.cardImage).replace(/"/g, '&quot;') + '" alt="" />'
        : icon(cfg.hero.cardIcon || 'shield');
    }

    // Stats
    var stats = document.getElementById('stats');
    show(stats, cfg.stats.visible !== false);
    sectionBg(stats, cfg.stats.bg);
    setHTML('#stats-grid', (cfg.stats.items || []).map(function (it) {
      return '<div>' + (it.icon ? '<div class="stat-icon"' + st({ 'background-color': cfg.stats.iconBg, color: cfg.stats.iconColor }) + '>' + icon(it.icon) + '</div>' : '') +
        '<div class="stat-value"' + st({ color: cfg.stats.titleColor }) + '>' + esc(it.value) + '</div>' +
        '<div class="stat-label"' + st({ color: cfg.stats.textColor }) + '>' + esc(it.label) + '</div></div>';
    }).join(''));

    // About
    var about = document.getElementById('about');
    show(about, cfg.about.visible !== false);
    sectionBg(about, cfg.about.bg);
    setText('#about-kicker', cfg.about.kicker);
    setText('#about-title', cfg.about.title);
    setText('#about-body', cfg.about.body);
    paint('#about-title', 'color', cfg.about.titleColor);
    paint('#about-body', 'color', cfg.about.textColor);
    setHTML('#about-points', (cfg.about.points || []).map(function (p) {
      return '<li>' + icon(cfg.about.pointsIcon || 'check') + '<span' + st({ color: cfg.about.textColor }) + '>' + esc(p) + '</span></li>';
    }).join(''));
    renderAboutSlider(cfg.about);
    show(document.getElementById('about-media'), aboutHasImage(cfg.about));

    // Services
    var services = document.getElementById('services');
    show(services, cfg.services.visible !== false);
    sectionBg(services, cfg.services.bg);
    setText('#services-kicker', cfg.services.kicker);
    setText('#services-title', cfg.services.title);
    setText('#services-subtitle', cfg.services.subtitle);
    paint('#services-title', 'color', cfg.services.titleColor);
    paint('#services-subtitle', 'color', cfg.services.textColor);
    setHTML('#services-grid', (cfg.services.items || []).map(function (it) {
      return iconCard(cfg.services, it);
    }).join(''));

    // Why
    var why = document.getElementById('why');
    show(why, cfg.why.visible !== false);
    sectionBg(why, cfg.why.bg);
    setText('#why-kicker', cfg.why.kicker);
    setText('#why-title', cfg.why.title);
    setText('#why-subtitle', cfg.why.subtitle);
    paint('#why-title', 'color', cfg.why.titleColor);
    paint('#why-subtitle', 'color', cfg.why.textColor);
    setHTML('#why-grid', (cfg.why.items || []).map(function (it) {
      return iconCard(cfg.why, it);
    }).join(''));

    // Process
    var process = document.getElementById('process');
    show(process, cfg.process.visible !== false);
    sectionBg(process, cfg.process.bg);
    setText('#process-kicker', cfg.process.kicker);
    setText('#process-title', cfg.process.title);
    setText('#process-subtitle', cfg.process.subtitle);
    paint('#process-title', 'color', cfg.process.titleColor);
    paint('#process-subtitle', 'color', cfg.process.textColor);
    setHTML('#steps-grid', (cfg.process.items || []).map(function (it, i) {
      return '<div class="step"' + st({ 'background-color': cfg.process.cardBg }) + '>' +
        '<div class="step-num"' + st({ 'background-color': cfg.process.iconBg, color: cfg.process.iconColor }) + '>' + (it.icon ? icon(it.icon) : (i + 1)) + '</div>' +
        '<h3' + st({ color: cfg.process.titleColor }) + '>' + esc(it.title) + '</h3>' +
        '<p' + st({ color: cfg.process.textColor }) + '>' + esc(it.desc) + '</p></div>';
    }).join(''));

    // Projects
    var projects = document.getElementById('projects');
    show(projects, cfg.projects.visible !== false);
    sectionBg(projects, cfg.projects.bg);
    setText('#projects-kicker', cfg.projects.kicker);
    setText('#projects-title', cfg.projects.title);
    setText('#projects-subtitle', cfg.projects.subtitle);
    paint('#projects-title', 'color', cfg.projects.titleColor);
    paint('#projects-subtitle', 'color', cfg.projects.textColor);
    setHTML('#projects-grid', (cfg.projects.items || []).map(function (it) {
      var media = it.image
        ? '<div class="project-media" style="background-image:url(&quot;' + esc(it.image) + '&quot;)"></div>'
        : '';
      return '<article class="card project-card"' + st({ background: cfg.projects.cardBg }) + '>' + media +
        '<div class="project-top"' + st({ 'background': cfg.projects.iconBg, color: cfg.projects.iconColor }) + '>' +
        (it.icon ? icon(it.icon) : '') +
        '<div class="project-cat">' + esc(it.category) + '</div></div>' +
        '<div class="project-body"><h3' + st({ color: cfg.projects.titleColor }) + '>' + esc(it.title) + '</h3>' +
        '<p' + st({ color: cfg.projects.textColor }) + '>' + esc(it.desc) + '</p></div></article>';
    }).join(''));

    // Support (brand CCTV & perangkat)
    var support = document.getElementById('support');
    if (support && cfg.support) {
      show(support, cfg.support.visible !== false);
      sectionBg(support, cfg.support.bg);
      applyGradient(support, cfg.support);
      applyBgImage(support, cfg.support);
      setText('#support-kicker', cfg.support.kicker);
      setText('#support-title', cfg.support.title);
      setText('#support-subtitle', cfg.support.subtitle);
      paint('#support-title', 'color', cfg.support.titleColor);
      paint('#support-subtitle', 'color', cfg.support.textColor);
      var ob = cfg.support.boxOutline || {};
      var outlineCss = (ob.enabled === false) ? 'none'
        : ((parseFloat(ob.width) || 1) + 'px solid ' + (ob.color || '#E3E9F2'));
      var coverCls = cfg.support.imageCover ? ' cover' : '';
      setHTML('#support-grid', (cfg.support.items || []).map(function (it) {
        var media = it.image
          ? '<div class="brand-logo' + coverCls + '"' + st({ border: outlineCss }) + '><img src="' + esc(it.image) + '" alt="' + esc(it.name || '') + '" /></div>'
          : '<div class="brand-logo brand-logo-text' + coverCls + '"' + st({ border: outlineCss }) + '>' + esc(initials(it.name)) + '</div>';
        var desc = it.desc ? '<p' + st({ color: cfg.support.textColor }) + '>' + esc(it.desc) + '</p>' : '';
        return '<article class="brand-card"' + st({ background: cfg.support.cardBg }) + '>' + media +
          '<div class="brand-body"><h3' + st({ color: cfg.support.titleColor }) + '>' + esc(it.name) + '</h3>' + desc + '</div></article>';
      }).join(''));
    }

    // Testimonials
    var testi = document.getElementById('testimonials');
    show(testi, cfg.testimonials.visible !== false);
    sectionBg(testi, cfg.testimonials.bg);
    setText('#testi-kicker', cfg.testimonials.kicker);
    setText('#testi-title', cfg.testimonials.title);
    setText('#testi-subtitle', cfg.testimonials.subtitle);
    paint('#testi-title', 'color', cfg.testimonials.titleColor);
    paint('#testi-subtitle', 'color', cfg.testimonials.textColor);
    setHTML('#quotes-grid', (cfg.testimonials.items || []).map(function (it) {
      var avatar = it.photo
        ? '<span class="quote-avatar"><img src="' + esc(it.photo) + '" alt="' + esc(it.name || '') + '" /></span>'
        : '<span class="quote-avatar"' + st({ 'background-color': cfg.testimonials.iconBg, color: cfg.testimonials.iconColor }) + '>' + esc(initials(it.name)) + '</span>';
      return '<figure class="quote"' + st({ 'background-color': cfg.testimonials.cardBg }) + '>' +
        '<figcaption class="quote-who">' + avatar +
        '<span class="quote-name"><strong' + st({ color: cfg.testimonials.titleColor }) + '>' + esc(it.name) + '</strong>' +
        '<small' + st({ color: cfg.testimonials.textColor }) + '>' + esc(it.role) + '</small></span></figcaption>' +
        '<p' + st({ color: cfg.testimonials.textColor }) + '>' + esc(it.quote) + '</p></figure>';
    }).join(''));

    // CTA
    var cta = document.getElementById('cta');
    show(cta, cfg.cta.visible !== false);
    sectionBg(cta, cfg.cta.bg);
    setText('#cta-title', cfg.cta.title);
    setText('#cta-text', cfg.cta.text);
    setText('#cta-button', cfg.cta.button);
    paint('#cta-title', 'color', cfg.cta.titleColor);
    paint('#cta-text', 'color', cfg.cta.textColor);

    // Contact
    var contact = document.getElementById('contact');
    show(contact, cfg.contact.visible !== false);
    sectionBg(contact, cfg.contact.bg);
    setText('#contact-kicker', cfg.contact.kicker);
    setText('#contact-title', cfg.contact.title);
    setText('#contact-subtitle', cfg.contact.subtitle);
    setHTML('#ic-address', icon(cfg.contact.iconAddress || 'pin'));
    setHTML('#ic-phone', icon(cfg.contact.iconPhone || 'phone'));
    setHTML('#ic-email', icon(cfg.contact.iconEmail || 'mail'));
    setHTML('#ic-hours', icon(cfg.contact.iconHours || 'clock'));
    setText('#contact-address', cfg.contact.address);
    setText('#contact-phone', cfg.contact.phone);
    setText('#contact-whatsapp', cfg.contact.whatsapp);
    setText('#contact-email', cfg.contact.email);
    setText('#contact-hours', cfg.contact.hours);
    paint('#contact-title', 'color', cfg.contact.titleColor);
    paint('#contact-subtitle', 'color', cfg.contact.textColor);
    paintAll('.contact-item', 'background-color', cfg.contact.cardBg);
    paintAll('.contact-item .icon', 'color', cfg.contact.iconColor);
    paintAll('.contact-item strong', 'color', cfg.contact.titleColor);
    paintAll('.contact-item span', 'color', cfg.contact.textColor);
    var slots = document.querySelectorAll('.contact-item .ic-slot');
    for (var si = 0; si < slots.length; si++) {
      if (cfg.contact.iconBg) { slots[si].classList.add('ic-chip'); slots[si].style.backgroundColor = cfg.contact.iconBg; }
      else { slots[si].classList.remove('ic-chip'); slots[si].style.removeProperty('background-color'); }
    }
    var waLink = document.getElementById('contact-wa-link');
    currentWa = String(cfg.contact.whatsapp || '').replace(/[^\d]/g, '');
    currentBrand = cfg.brand.name || '';
    if (waLink) waLink.href = 'https://wa.me/' + currentWa;
    var mailLink = document.getElementById('contact-mail-link');
    if (mailLink) mailLink.href = 'mailto:' + cfg.contact.email;
    renderMap(cfg.contact);

    // Footer
    setText('#footer-text', cfg.footer.text);
    setText('#footer-copyright', cfg.footer.copyright);
    setText('#footer-services-title', cfg.footer.servicesTitle || 'Bidang Layanan');
    setText('#footer-services-note', cfg.footer.servicesNote || (cfg.hero.services || []).slice(0, 5).join(' • '));
    paintAll('.footer .brand', 'color', cfg.footer.titleColor);
    paintAll('.footer h4', 'color', cfg.footer.titleColor);
    paintAll('.footer p', 'color', cfg.footer.textColor);

    // Gambar latar per bagian
    applyBgImage(document.getElementById('stats'), cfg.stats);
    applyBgImage(document.getElementById('services'), cfg.services);
    applyBgImage(document.getElementById('why'), cfg.why);
    applyBgImage(document.getElementById('process'), cfg.process);
    applyBgImage(document.getElementById('projects'), cfg.projects);
    applyBgImage(document.getElementById('testimonials'), cfg.testimonials);
    applyBgImage(document.querySelector('.cta-band'), cfg.cta);
    applyBgImage(document.getElementById('contact'), cfg.contact);
    applyBgImage(document.querySelector('.footer'), cfg.footer);

    // Gradasi latar per bagian
    applyGradient(document.getElementById('hero'), cfg.hero);
    applyGradient(document.getElementById('stats'), cfg.stats);
    applyGradient(document.getElementById('about'), cfg.about);
    applyGradient(document.getElementById('services'), cfg.services);
    applyGradient(document.getElementById('why'), cfg.why);
    applyGradient(document.getElementById('process'), cfg.process);
    applyGradient(document.getElementById('projects'), cfg.projects);
    applyGradient(document.getElementById('testimonials'), cfg.testimonials);
    applyGradient(document.querySelector('.cta-band'), cfg.cta);
    applyGradient(document.getElementById('contact'), cfg.contact);
    applyGradient(document.querySelector('.footer'), cfg.footer);
  }

  window.MSL = {
    STORAGE_KEY: STORAGE_KEY,
    load: currentConfig,
    render: render,
    deepMerge: deepMerge
  };

  render(currentConfig());

  window.addEventListener('message', function (ev) {
    if (ev.data && ev.data.type === 'msl-config' && ev.data.config) {
      render(ev.data.config);
    }
  });

  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      document.querySelector('.nav-links').classList.toggle('open');
    });
  }

  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var note = document.getElementById('form-note');
      function v(name) { var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }
      if (!currentWa) {
        if (note) note.textContent = 'Nomor WhatsApp kantor belum diisi. Atur di Studio Kustomisasi → Kontak → Telepon & WhatsApp.';
        return;
      }
      var lines = ['Halo' + (currentBrand ? ' ' + currentBrand : '') + ', saya ingin bertanya / menjalin kerja sama:', ''];
      if (v('name')) lines.push('• Nama: ' + v('name'));
      if (v('company')) lines.push('• Perusahaan/Instansi: ' + v('company'));
      if (v('email')) lines.push('• Email: ' + v('email'));
      if (v('phone')) lines.push('• Telepon: ' + v('phone'));
      if (v('topic')) lines.push('• Kebutuhan: ' + v('topic'));
      if (v('message')) lines.push('• Pesan: ' + v('message'));
      var url = 'https://wa.me/' + currentWa + '?text=' + encodeURIComponent(lines.join('\n'));
      var win = window.open(url, '_blank', 'noopener');
      if (!win) { window.location.href = url; }
      if (note) note.textContent = 'Membuka WhatsApp… pesan Anda sudah terisi otomatis — tekan kirim di WhatsApp.';
    });
  }

  /* Akses tersembunyi ke Studio Kustomisasi: buka index.html#studio (atau ?studio=1).
     Tanpa pemicu itu, tidak ada tautan studio apa pun di halaman publik. */
  (function studioAccess() {
    try {
      if (/[?&]studio=1(?:&|$)/.test(location.search) || location.hash === '#studio') {
        sessionStorage.setItem('msl-studio-access', '1');
      }
      if (sessionStorage.getItem('msl-studio-access') !== '1') return;
      var a = document.createElement('a');
      a.className = 'studio-fab';
      a.href = 'customize.html';
      a.title = 'Studio Kustomisasi';
      a.setAttribute('aria-label', 'Buka Studio Kustomisasi');
      a.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + window.MSL_ICONS.gear + '</svg>';
      document.body.appendChild(a);
    } catch (e) { /* mode privat/penyimpanan tidak tersedia */ }
  })();
})();
