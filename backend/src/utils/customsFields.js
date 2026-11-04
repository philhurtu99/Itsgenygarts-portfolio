import { profileCustomsFields } from './customsProfiles.js';

export function categoryCustomsFieldsFromBody(body, kind) {
  const data = {};
  if (Object.hasOwn(body, 'customsProfileKey')) {
    if (!body.customsProfileKey) data.customsProfileKey = null;
    else {
      const profile = profileCustomsFields(body.customsProfileKey, kind);
      if (!profile) return { error: 'Le profil douanier ne correspond pas à cette catégorie.' };
      data.customsProfileKey = profile.customsProfileKey;
    }
  }
  if (Object.hasOwn(body, 'customsOriginCountry')) {
    const country = String(body.customsOriginCountry || '').trim().toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) return { error: 'Le pays de fabrication doit être un code de deux lettres.' };
    data.customsOriginCountry = country || null;
  }
  return { data };
}

export function customsFieldsFromBody(body, { kind } = {}) {
  const data = {};
  if (Object.hasOwn(body, 'customsProfileKey')) {
    if (!body.customsProfileKey) data.customsProfileKey = null;
    else {
      const profile = profileCustomsFields(body.customsProfileKey, kind);
      if (!profile) return { error: 'Le profil douanier ne correspond pas à cet article.' };
      Object.assign(data, profile);
    }
  }
  for (const key of ['customsDescription', 'customsWeightGrams', 'customsOriginCountry', 'customsHsCode']) {
    if (data.customsProfileKey && (key === 'customsDescription' || key === 'customsHsCode')) continue;
    if (!Object.hasOwn(body, key)) continue;
    if (body[key] == null || body[key] === '') {
      data[key] = null;
      continue;
    }
    const value = String(body[key]).trim();
    if (key === 'customsWeightGrams') {
      const weight = Number(value);
      if (!Number.isFinite(weight) || weight < 0.01 || weight > 99999999.99) {
        return { error: 'Le poids net douanier doit être supérieur à zéro.' };
      }
      data[key] = Math.round(weight * 100) / 100;
    } else if (key === 'customsOriginCountry') {
      if (!/^[A-Za-z]{2}$/.test(value)) return { error: 'Le pays de fabrication doit être un code de deux lettres.' };
      data[key] = value.toUpperCase();
    } else if (key === 'customsHsCode') {
      const code = value.replace(/[.\s]/g, '');
      if (!/^\d{6,12}$/.test(code)) return { error: 'Le code douanier doit contenir de 6 à 12 chiffres.' };
      data[key] = code;
    } else {
      if (value.length < 3 || value.length > 100) return { error: 'La description douanière doit contenir de 3 à 100 caractères.' };
      data[key] = value;
    }
  }
  if (data.customsWeightGrams && body.packageWeightGrams && data.customsWeightGrams > Number(body.packageWeightGrams)) {
    return { error: 'Le poids net ne peut pas dépasser le poids emballé.' };
  }
  return { data };
}
