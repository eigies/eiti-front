import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Pipe de markdown mínimo para respuestas del asistente IA: headers, negrita, listas,
 * tablas y párrafos. Escapa el texto crudo antes de aplicar reemplazos, así el HTML
 * resultante es seguro. Uso: `[innerHTML]="message.content | markdownLite"`.
 */
@Pipe({ name: 'markdownLite', standalone: true })
export class MarkdownLitePipe implements PipeTransform {
  constructor(private readonly sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lines = escaped.split('\n');
    const html: string[] = [];
    let i = 0;
    let inList = false;

    const closeList = () => {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
    };

    const inline = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
    const isTableSeparator = (line: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
    const splitCells = (line: string) =>
      line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());

    while (i < lines.length) {
      const line = lines[i];

      const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headerMatch) {
        closeList();
        const level = Math.min(headerMatch[1].length + 3, 6);
        html.push(`<h${level}>${inline(headerMatch[2])}</h${level}>`);
        i++;
        continue;
      }

      if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        closeList();
        const headerCells = splitCells(line);
        html.push('<div class="assistant-table-wrap"><table><thead><tr>');
        for (const cell of headerCells) {
          html.push(`<th>${inline(cell)}</th>`);
        }
        html.push('</tr></thead><tbody>');
        i += 2;
        while (i < lines.length && isTableRow(lines[i])) {
          html.push('<tr>');
          for (const cell of splitCells(lines[i])) {
            html.push(`<td>${inline(cell)}</td>`);
          }
          html.push('</tr>');
          i++;
        }
        html.push('</tbody></table></div>');
        continue;
      }

      const bulletMatch = line.match(/^[-*]\s+(.*)$/);
      if (bulletMatch) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push(`<li>${inline(bulletMatch[1])}</li>`);
        i++;
        continue;
      }

      closeList();
      if (line.trim().length) {
        html.push(`<p>${inline(line)}</p>`);
      }
      i++;
    }
    closeList();

    return this.sanitizer.bypassSecurityTrustHtml(html.join(''));
  }
}
