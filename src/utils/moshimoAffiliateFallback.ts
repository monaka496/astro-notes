export const showMoshimoFallback = (root: HTMLElement) => {
    const scripts = [...root.querySelectorAll("script")];
    for (const script of scripts) {
      const source = script.textContent || "";
      const callStart = source.lastIndexOf("msmaflink(");
      if (callStart < 0) continue;
      const objectStart = source.indexOf("{", callStart);
      if (objectStart < 0) continue;

      let depth = 0;
      let inString = false;
      let escaped = false;
      let objectEnd = -1;
      for (let i = objectStart; i < source.length; i++) {
        const char = source[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') inString = true;
        else if (char === "{") depth++;
        else if (char === "}" && --depth === 0) {
          objectEnd = i + 1;
          break;
        }
      }
      if (objectEnd < 0) continue;

      try {
        const item = JSON.parse(source.slice(objectStart, objectEnd)) as {
          eid?: string;
          n?: string;
          b?: string;
          v?: string;
          d?: string;
          c_p?: string;
          p?: string[];
          u?: { u?: string; t?: string };
          b_l?: Array<{
            u_tx?: string;
            u_bc?: string;
            u_url?: string;
            a_id?: number;
            p_id?: number;
            pc_id?: number;
            pl_id?: number;
            s_n?: string;
            s_v?: string;
          }>;
        };
        if (!item.eid) continue;
        const placeholder = [...root.querySelectorAll<HTMLElement>("[id^='msmaflink-']")]
          .find((element) => element.id === `msmaflink-${item.eid}`);
        if (!placeholder || placeholder.textContent?.trim() !== "リンク") continue;

        const card = document.createElement("section");
        card.className = "my-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center";
        if (item.d && item.c_p && item.p?.[0]) {
          try {
            const image = document.createElement("img");
            image.src = new URL(`${item.c_p}${item.p[0]}`, item.d).toString();
            image.alt = item.n || "";
            image.className = "mx-auto max-h-48 w-full max-w-48 rounded-lg object-contain sm:mx-0";
            card.append(image);
          } catch {
            // Keep showing the preview card when an optional image URL is malformed.
          }
        }
        const details = document.createElement("div");
        details.className = "min-w-0 flex-1";
        if (item.b) {
          const maker = document.createElement("p");
          maker.className = "mb-1 text-sm text-slate-600";
          maker.textContent = item.b;
          details.append(maker);
        }
        const title = document.createElement("p");
        title.className = "mb-3 font-bold leading-relaxed text-slate-900";
        const primaryButton = item.b_l?.find((button) => button.s_n === item.u?.t);
        const primaryUrl = primaryButton ? getMoshimoAffiliateUrl(primaryButton, item) : "";
        if (primaryUrl) {
          const titleLink = document.createElement("a");
          titleLink.href = primaryUrl;
          titleLink.target = "_blank";
          titleLink.rel = "nofollow sponsored noopener noreferrer";
          titleLink.referrerPolicy = "no-referrer-when-downgrade";
          titleLink.textContent = item.n || "商品リンク";
          title.append(titleLink);
        } else {
          title.textContent = item.n || "商品リンク";
        }
        details.append(title);
        const buttons = document.createElement("div");
        buttons.className = "flex flex-col gap-2 sm:flex-row";
        for (const button of item.b_l || []) {
          const affiliateUrl = getMoshimoAffiliateUrl(button, item);
          if (!affiliateUrl) continue;
          const link = document.createElement("a");
          link.href = affiliateUrl;
          link.target = "_blank";
          link.rel = "nofollow sponsored noopener noreferrer";
          link.referrerPolicy = "no-referrer-when-downgrade";
          link.textContent = button.u_tx || "商品を見る";
          link.className = "moshimo-preview-button inline-flex w-full justify-center rounded-lg px-4 py-2 text-sm font-bold text-white no-underline sm:w-auto sm:flex-1";
          link.style.backgroundColor = button.u_bc && /^#[0-9a-f]{3,8}$/i.test(button.u_bc) ? button.u_bc : "#475569";
          buttons.append(link);
        }
        details.append(buttons);
        card.append(details);
        placeholder.replaceChildren(card);
      } catch (error) {
        console.warn("Could not render the Moshimo affiliate fallback.", error);
      }
    }
  };

  const getMoshimoAffiliateUrl = (
    button: { u_url?: string; a_id?: number; p_id?: number; pc_id?: number; pl_id?: number; s_n?: string; s_v?: string },
    item: { v?: string; u?: { u?: string; t?: string } },
  ) => {
    if (!button.u_url || !button.a_id || !button.p_id || !button.pc_id || !button.pl_id) return "";
    try {
      let destination = button.u_url;
      if (item.u?.t === button.s_n && item.u?.u) {
        destination = item.u.u;
      } else if (!(Number(item.v) >= 2.1 && button.s_n !== "yahoo")) {
        destination = encodeURI(decodeURI(destination));
      }
      const domainParts = window.location.hostname.split(".");
      const suffix = domainParts.pop();
      const service = domainParts.pop();
      const moshimoDomain = suffix === "msm" ? `${service}.msm` : "moshimo.com";
      let affiliateUrl = `https://af.${moshimoDomain}/af/c/click?a_id=${button.a_id}&p_id=${button.p_id}&pc_id=${button.pc_id}&pl_id=${button.pl_id}&url=${encodeURIComponent(destination)}`;
      if (button.s_v) affiliateUrl += `&s_v=${encodeURIComponent(button.s_v)}`;
      return affiliateUrl;
    } catch {
      return "";
    }
  };

