/**
 * Browser bundle for hero-host Playwright probes (loaded via page.addInitScript).
 */
(() => {
  function intersectAxis(a, b) {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  function nodeClipsDescendants(node, style) {
    if (node.classList?.contains("panel-scroll-body")) return true;
    if (node.getAttribute?.("data-role") === "hero-scroll") return true;
    const vals = [style.overflow, style.overflowX, style.overflowY];
    return vals.some((v) => v === "hidden" || v === "clip");
  }

  function collectClippingAncestorRects(el) {
    const clips = [{ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }];
    let node = el;
    while (node) {
      const style = getComputedStyle(node);
      if (nodeClipsDescendants(node, style)) {
        const br = node.getBoundingClientRect();
        clips.push({ left: br.left, top: br.top, right: br.right, bottom: br.bottom });
      }
      node = node.parentElement;
    }
    return clips;
  }

  function effectiveVisibleClip(el) {
    const clips = collectClippingAncestorRects(el);
    let out = clips[0];
    for (let i = 1; i < clips.length; i++) {
      out = intersectAxis(out, clips[i]);
    }
    return {
      ...out,
      width: Math.max(0, out.right - out.left),
      height: Math.max(0, out.bottom - out.top),
    };
  }

  function rectFullyInClip(domRect, clip, eps = 1) {
    if (!domRect || domRect.width < 1 || domRect.height < 1) return false;
    return (
      domRect.left >= clip.left - eps &&
      domRect.top >= clip.top - eps &&
      domRect.right <= clip.right + eps &&
      domRect.bottom <= clip.bottom + eps
    );
  }

  function rectMeaningfullyInClip(domRect, clip, minW = 10, minH = 8, eps = 1) {
    if (!domRect || domRect.width < 1 || domRect.height < 1) return false;
    const inter = intersectAxis(
      {
        left: domRect.left,
        top: domRect.top,
        right: domRect.right,
        bottom: domRect.bottom,
      },
      {
        left: clip.left - eps,
        top: clip.top - eps,
        right: clip.right + eps,
        bottom: clip.bottom + eps,
      },
    );
    return inter.width >= minW && inter.height >= minH;
  }

  function findTargetHeroListRow(templateCfgId) {
    const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
    const selectedRow = panel?.querySelector(
      `.hero-list li[data-template-cfg-id="${templateCfgId}"].selected, .hero-list li[data-template-cfg-id="${templateCfgId}"][aria-selected="true"]`,
    );
    return (
      selectedRow ||
      panel?.querySelector(`.hero-list li[data-template-cfg-id="${templateCfgId}"]`) ||
      null
    );
  }

  /**
   * Scroll production hero-scroll so the target row's round list avatar + primary name
   * sit inside the clip-ancestor ∩ viewport chain (1600 portrait evidence).
   */
  function elementTopInScrollContainer(scroll, el) {
    const er = el.getBoundingClientRect();
    const sr = scroll.getBoundingClientRect();
    return er.top - sr.top + scroll.scrollTop;
  }

  /** Close recruit details only; do not mutate captive/persuade/coming sections (production UI). */
  function prepareHeroHostEvidenceChrome() {
    const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
    if (!panel) return;
    const host = panel.querySelector('[data-role="hero-recruit-host"]');
    if (host instanceof HTMLDetailsElement) host.open = false;
  }

  function clampHeroScrollTop(scroll, top) {
    const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    return Math.max(0, Math.min(top, max));
  }

  function scrollHeroListRowForPortraitViewport(templateCfgId) {
    const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
    const scroll = panel?.querySelector('[data-role="hero-scroll"]');
    const listRow = findTargetHeroListRow(templateCfgId);
    if (!(scroll instanceof HTMLElement) || !(listRow instanceof HTMLElement)) return;

    const avatar = listRow.querySelector('[data-role="hero-list-avatar"]');
    const nameEl = listRow.querySelector(".hero-list-row-primary");
    if (!(avatar instanceof HTMLElement)) return;
    const targets = nameEl instanceof HTMLElement ? [avatar, nameEl] : [avatar];

    scroll.scrollTop = clampHeroScrollTop(scroll, elementTopInScrollContainer(scroll, avatar) - 32);

    const margin = 6;
    const minClipH = 64;
    for (let pass = 0; pass < 64; pass++) {
      let clip = effectiveVisibleClip(targets[0]);
      if (clip.height < minClipH) {
        scroll.scrollTop = clampHeroScrollTop(scroll, elementTopInScrollContainer(scroll, avatar) - 32);
        clip = effectiveVisibleClip(targets[0]);
      }
      const padded = {
        left: clip.left + margin,
        top: clip.top + margin,
        right: clip.right - margin,
        bottom: clip.bottom - margin,
      };
      if (padded.bottom <= padded.top + minClipH) {
        scroll.scrollTop = clampHeroScrollTop(scroll, elementTopInScrollContainer(scroll, avatar) - 32);
        continue;
      }
      const rects = targets.map((el) => el.getBoundingClientRect());
      const ok = rects.every((r) => rectFullyInClip(r, padded, 0.5));
      if (ok) return;

      let delta = 0;
      for (const r of rects) {
        if (r.top < padded.top) delta -= padded.top - r.top;
        if (r.bottom > padded.bottom) delta += r.bottom - padded.bottom;
      }
      if (Math.abs(delta) < 0.25) break;
      scroll.scrollTop = clampHeroScrollTop(scroll, scroll.scrollTop + delta);
    }
  }

  function scrollHeroDetailFooterIntoView() {
    const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
    const scroll = panel?.querySelector('[data-role="hero-scroll"]');
    const hint = panel?.querySelector(".hero-detail-hint");
    if (!(scroll instanceof HTMLElement) || !(hint instanceof HTMLElement)) return;
    scroll.scrollTop = scroll.scrollHeight;
    for (let pass = 0; pass < 48; pass++) {
      const clip = effectiveVisibleClip(scroll);
      const hr = hint.getBoundingClientRect();
      if (hr.height > 0 && rectFullyInClip(hr, clip, 1)) return;
      if (hr.bottom > clip.bottom) scroll.scrollTop += hr.bottom - clip.bottom + 4;
      else if (hr.top < clip.top) scroll.scrollTop -= clip.top - hr.top + 4;
      else break;
    }
  }

  function scrollHeroDetailHeadForSameFrame() {
    const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
    const scroll = panel?.querySelector('[data-role="hero-scroll"]');
    const bust = panel?.querySelector('[data-role="hero-detail-bust"]');
    const name = panel?.querySelector(".hero-detail-name");
    if (!(scroll instanceof HTMLElement) || !(bust instanceof HTMLElement)) return;

    const targets = name instanceof HTMLElement ? [bust, name] : [bust];
    const margin = 4;
    const scrollRect = scroll.getBoundingClientRect();
    const bustRect0 = bust.getBoundingClientRect();
    scroll.scrollTop += bustRect0.top - scrollRect.top - margin;
    if (name instanceof HTMLElement) {
      const nameRect0 = name.getBoundingClientRect();
      const unionBottom = Math.max(bustRect0.bottom, nameRect0.bottom);
      if (unionBottom > scrollRect.bottom - margin) {
        scroll.scrollTop += unionBottom - (scrollRect.bottom - margin);
      }
    }
    for (let pass = 0; pass < 28; pass++) {
      const clip = effectiveVisibleClip(targets[0]);
      const padded = {
        left: clip.left + margin,
        top: clip.top + margin,
        right: clip.right - margin,
        bottom: clip.bottom - margin,
      };
      const rects = targets.map((el) => el.getBoundingClientRect());
      const ok = rects.every((r) => rectFullyInClip(r, padded, 0.5));
      if (ok) return;

      let delta = 0;
      for (const r of rects) {
        if (r.top < padded.top) delta -= padded.top - r.top;
        if (r.bottom > padded.bottom) delta += r.bottom - padded.bottom;
      }
      if (Math.abs(delta) < 0.25) break;
      scroll.scrollTop += delta;
    }
  }

  function probeBustNameSameFrame() {
    const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
    const scroll = panel?.querySelector(".panel-scroll-body");
    const bust = panel?.querySelector('[data-role="hero-detail-bust"]');
    const name = panel?.querySelector(".hero-detail-name");
    const br = bust?.getBoundingClientRect();
    const nr = name?.getBoundingClientRect();
    const clipEl =
      scroll instanceof HTMLElement ? scroll : bust instanceof HTMLElement ? bust : null;
    const clip = clipEl ? effectiveVisibleClip(clipEl) : null;

    const bustInClip =
      !!br &&
      !!clip &&
      br.width >= 120 &&
      br.height >= 120 &&
      rectFullyInClip(br, clip, 1);
    const nameInClip =
      !!nr && !!clip && nr.width > 0 && nr.height > 0 && rectFullyInClip(nr, clip, 1);
    const nameRightOfBust = !!(br && nr && nr.left >= br.right - 24);
    const verticalBandOverlap =
      !!(br && nr && nr.bottom > br.top + 8 && nr.top < br.bottom - 8);
    const gapPx = br && nr ? Math.round(nr.left - br.right) : null;
    const gapNear10px = gapPx != null && gapPx >= 4 && gapPx <= 18;

    return {
      ok: bustInClip && nameInClip && nameRightOfBust && verticalBandOverlap && gapNear10px,
      bustInClip,
      nameInClip,
      bustInViewport: bustInClip,
      nameInViewport: nameInClip,
      nameRightOfBust,
      verticalBandOverlap,
      gapPx,
      gapNear10px,
      visibleClip: clip
        ? { left: clip.left, top: clip.top, width: clip.width, height: clip.height }
        : null,
      name: { text: name?.textContent?.trim() },
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    };
  }

  function probeHeroPortraitFrames(templateCfgId, options = {}) {
    const requireListAvatarInClip = options.requireListAvatarInClip === true;
    const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
    const layoutFrame = document.getElementById("layout-frame");
    const uiScale = parseFloat(
      getComputedStyle(layoutFrame || document.body).getPropertyValue("--ui-scale") || "1",
    );
    const detail = panel?.querySelector(".hero-detail");
    const detailName = detail?.querySelector(".hero-detail-name");
    const attrTable = detail?.querySelector(".hero-attr-table");
    const detailError = detail?.querySelector(".panel-state-chrome.is-error");
    const detailText = detail?.textContent ?? "";
    const heroDetailLoaded =
      !!detailName &&
      !!attrTable &&
      !detailError &&
      !/hero not found|将领不存在/i.test(detailText);

    const listRow =
      findTargetHeroListRow(templateCfgId) || panel?.querySelector(".hero-list li.selected");
    const avatar = listRow?.querySelector('[data-role="hero-list-avatar"]');
    const listRowPrimary = listRow?.querySelector(".hero-list-row-primary");
    const bust = detail?.querySelector('[data-role="hero-detail-bust"]');
    const head = detail?.querySelector(".hero-detail-head");
    const name = detail?.querySelector(".hero-detail-name");

    const avatarRect = avatar?.getBoundingClientRect();
    const listNameRect = listRowPrimary?.getBoundingClientRect();
    const bustRect = bust?.getBoundingClientRect();
    const headRect = head?.getBoundingClientRect();
    const nameRect = name?.getBoundingClientRect();
    const bustClip = bust ? effectiveVisibleClip(bust) : null;

    const avatarSrc = avatar instanceof HTMLImageElement ? avatar.currentSrc || avatar.src : "";
    const bustSrc = bust instanceof HTMLImageElement ? bust.currentSrc || bust.src : "";
    const dpr = window.devicePixelRatio;
    const avatarScale = avatar instanceof HTMLImageElement ? avatar.dataset.artTextureScale : null;
    const bustScale = bust instanceof HTMLImageElement ? bust.dataset.artTextureScale : null;
    const usesAvatar2x = avatarSrc.includes("/textures/2x/hero/avatar/");
    const usesAvatar1x = avatarSrc.includes("/textures/1x/hero/avatar/");
    const usesBust2x = bustSrc.includes("/textures/2x/hero/bust/");
    const usesBust1x = bustSrc.includes("/textures/1x/hero/bust/");
    const texturePickOk = dpr >= 1.75 ? usesAvatar2x && usesBust2x : usesAvatar1x && usesBust1x;
    const avatarPathOk = avatarSrc.includes(`/hero/avatar/${templateCfgId}.png`);
    const bustPathOk = bustSrc.includes(`/hero/bust/${templateCfgId}.png`);

    const listAvatarVisible = !!(avatarRect && avatarRect.width >= 48 && avatarRect.height >= 48);
    const listRowClip =
      avatar instanceof HTMLElement
        ? effectiveVisibleClip(avatar)
        : listRow instanceof HTMLElement
          ? effectiveVisibleClip(listRow)
          : null;
    const listAvatarInClip =
      !!avatarRect &&
      !!listRowClip &&
      avatarRect.width >= 52 &&
      avatarRect.height >= 52 &&
      rectFullyInClip(avatarRect, listRowClip, 1);
    const listNameInClip =
      !!listNameRect &&
      !!listRowClip &&
      listNameRect.width > 0 &&
      listNameRect.height > 0 &&
      rectMeaningfullyInClip(listNameRect, listRowClip, 36, 8, 1);
    const listAvatarRoundMask =
      avatar instanceof HTMLElement && getComputedStyle(avatar).borderRadius === "50%";
    const listRowTemplateOk =
      listRow?.getAttribute("data-template-cfg-id") === String(templateCfgId);
    const listAvatarFrameOk =
      listAvatarInClip &&
      listNameInClip &&
      listAvatarRoundMask &&
      listRowTemplateOk &&
      avatarPathOk;

    const scroll = panel?.querySelector('[data-role="hero-scroll"]');
    let scrollReachOk = true;
    let detailFooterVisible = true;
    let detailFooterTopInScroll = false;
    let detailFooterBottomInScroll = false;
    if (scroll instanceof HTMLElement) {
      scrollHeroDetailFooterIntoView();
      const scrollClip = effectiveVisibleClip(scroll);
      const hint = detail?.querySelector(".hero-detail-hint");
      if (hint instanceof HTMLElement) {
        const fr = hint.getBoundingClientRect();
        detailFooterTopInScroll = fr.height > 0 && fr.top >= scrollClip.top - 2;
        detailFooterBottomInScroll = fr.height > 0 && fr.bottom <= scrollClip.bottom + 2;
        detailFooterVisible = detailFooterTopInScroll && detailFooterBottomInScroll;
      }
      const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      scrollReachOk = maxTop <= 2 || detailFooterVisible;
    }

    const nameReadable =
      !!detailName?.textContent?.trim() && (detailName.textContent?.trim()?.length ?? 0) >= 2;
    const gapPx = bustRect && nameRect ? Math.round(nameRect.left - bustRect.right) : null;
    const nameBesideBustGapOk = gapPx != null && gapPx >= 4 && gapPx <= 18;
    const nameOverlapBust =
      !!(headRect && bustRect) &&
      headRect.left < bustRect.right - 2 &&
      headRect.top < bustRect.bottom - 2;

    const bustNameInClip =
      !!bustRect &&
      !!nameRect &&
      !!bustClip &&
      rectFullyInClip(bustRect, bustClip, 1) &&
      rectFullyInClip(nameRect, bustClip, 1);

    return {
      ok:
        heroDetailLoaded &&
        listAvatarVisible &&
        nameReadable &&
        !!bust &&
        texturePickOk &&
        avatarPathOk &&
        bustPathOk &&
        scrollReachOk &&
        (!requireListAvatarInClip || listAvatarFrameOk),
      template_cfg_id: templateCfgId,
      heroDetailLoaded,
      nameReadable,
      detailName: detailName?.textContent?.trim() ?? null,
      listAvatarVisible,
      listAvatarInClip,
      listNameInClip,
      listAvatarRoundMask,
      listRowTemplateOk,
      listAvatarFrameOk,
      listRowPrimaryText: listRowPrimary?.textContent?.trim() ?? null,
      dpr,
      uiScale,
      avatar: avatar
        ? {
            cssWidth: avatarRect?.width,
            cssHeight: avatarRect?.height,
            borderRadius: getComputedStyle(avatar).borderRadius,
            artTextureScale: avatarScale,
            srcTail: avatarSrc.split("/").slice(-4).join("/"),
          }
        : null,
      bust: bust
        ? {
            cssWidth: bustRect?.width,
            cssHeight: bustRect?.height,
            artTextureScale: bustScale,
            srcTail: bustSrc.split("/").slice(-4).join("/"),
            float: getComputedStyle(bust).float,
            marginRight: getComputedStyle(bust).marginRight,
          }
        : null,
      layout: {
        nameBesideBust: nameOverlapBust,
        gapPx,
        nameBesideBustGapOk,
        headLeft: headRect?.left,
        bustRight: bustRect?.right,
      },
      texturePickOk,
      usesAvatar1x,
      usesAvatar2x,
      usesBust1x,
      usesBust2x,
      avatarPathOk,
      bustPathOk,
      scrollReachOk,
      detailFooterVisible,
      detailFooterTopInScroll,
      detailFooterBottomInScroll,
      bustNameInClip,
      visibleClip: bustClip
        ? { left: bustClip.left, top: bustClip.top, width: bustClip.width, height: bustClip.height }
        : null,
      listVisibleClip: listRowClip
        ? {
            left: listRowClip.left,
            top: listRowClip.top,
            width: listRowClip.width,
            height: listRowClip.height,
          }
        : null,
    };
  }

  window.__heroHostCaptureProbes = {
    prepareHeroHostEvidenceChrome,
    scrollHeroDetailHeadForSameFrame,
    scrollHeroDetailFooterIntoView,
    scrollHeroListRowForPortraitViewport,
    probeBustNameSameFrame,
    probeHeroPortraitFrames,
  };
})();
