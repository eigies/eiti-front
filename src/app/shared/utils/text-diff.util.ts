/** Tramo de un texto: igual o distinto al mismo tramo de otro texto. */
export interface TextSegment {
  text: string;
  differs: boolean;
}

/**
 * Parte `text` en tramos que coinciden o no, caracter a caracter, con `other`. Sirve para resaltar en qué
 * difieren dos documentos (ej. dos CUIT): con largos distintos, o sin el otro, todo cuenta como distinto.
 */
export function diffSegments(text: string, other: string | null | undefined): TextSegment[] {
  if (!other || other.length !== text.length) {
    return text ? [{ text, differs: !!other && other !== text }] : [];
  }

  const segments: TextSegment[] = [];
  for (let i = 0; i < text.length; i++) {
    const differs = text[i] !== other[i];
    const last = segments[segments.length - 1];
    if (last && last.differs === differs) {
      last.text += text[i];
    } else {
      segments.push({ text: text[i], differs });
    }
  }

  return segments;
}
