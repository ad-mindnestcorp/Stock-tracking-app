import { promises as fs } from 'fs';
import path from 'path';
import { getCached } from './research-cache';
import type { ResearchTier } from './research-orchestrator.service';

const REPORTS_DIR = path.resolve(__dirname, '..', '..', '..', 'docs', 'research-reports');

interface ReportMetadata {
  symbol: string;
  companyName: string;
  tier: ResearchTier;
  timestamp: string;
  price: number;
}

async function ensureReportsDirectory(): Promise<void> {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  } catch (err) {
    console.error(`[markdown-report] Failed to create reports directory: ${err instanceof Error ? err.message : err}`);
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'full',
    timeStyle: 'long',
  });
}

function generateHeader(meta: ReportMetadata): string {
  return `# ${meta.companyName} (${meta.symbol}) - AI Research Report

**Generated:** ${meta.timestamp}  
**Research Tier:** ${meta.tier.charAt(0).toUpperCase() + meta.tier.slice(1)}  
**Current Price:** $${meta.price.toFixed(2)}

---
`;
}

function formatBulletList(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n');
}

function formatSection(title: string, content: Record<string, unknown>): string {
  let md = `## ${title}\n\n`;

  // Verdict
  if ('verdict' in content) {
    md += `**Verdict:** ${content.verdict}\n\n`;
  }

  // Handle different section structures
  for (const [key, value] of Object.entries(content)) {
    if (key === 'verdict') continue; // Already handled

    if (Array.isArray(value)) {
      const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      // Check if it's array of objects (like metrics or risks)
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        md += `### ${label}\n\n`;
        
        // Handle tables
        if (key === 'metrics') {
          md += '| Metric | Value | Note |\n';
          md += '|--------|-------|------|\n';
          value.forEach((item: any) => {
            md += `| ${item.label} | ${item.value} | ${item.note} |\n`;
          });
          md += '\n';
        } else if (key === 'risks') {
          value.forEach((item: any) => {
            md += `- **${item.label}:** ${item.description}\n`;
          });
          md += '\n';
        } else if (key === 'comparison_table') {
          if (value.length > 0) {
            const headers = Object.keys(value[0]);
            md += `| ${headers.join(' | ')} |\n`;
            md += `|${headers.map(() => '---').join('|')}|\n`;
            value.forEach((row: any) => {
              md += `| ${headers.map(h => row[h] ?? 'N/A').join(' | ')} |\n`;
            });
            md += '\n';
          }
        } else if (key === 'quarterly_data') {
          if (value.length > 0) {
            md += '| Quarter | Revenue Growth | EBITDA Margin | Score |\n';
            md += '|---------|----------------|---------------|-------|\n';
            value.forEach((item: any) => {
              md += `| ${item.quarter} | ${item.revenue_growth} | ${item.ebitda_margin} | ${item.score} |\n`;
            });
            md += '\n';
          }
        } else if (key === 'top_customers') {
          value.forEach((item: any) => {
            md += `- ${item.rank}: ${item.revenue_pct} (${item.trend})\n`;
          });
          md += '\n';
        } else {
          // Generic object array
          value.forEach((item: any) => {
            md += `- ${JSON.stringify(item)}\n`;
          });
          md += '\n';
        }
      } else if (value.length > 0 && typeof value[0] === 'string') {
        // Array of strings (bullet points)
        md += `### ${label}\n\n${formatBulletList(value)}\n\n`;
      }
    } else if (typeof value === 'string') {
      const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      md += `**${label}:** ${value}\n\n`;
    }
  }

  return md + '\n';
}

const SECTION_TITLES: Record<string, string> = {
  research_foundation: '1. Research Foundation',
  valuation_financials: '2. Valuation & Financials',
  risk_red_teaming: '3. Risk & Red Teaming',
  technicals: '4. Technical Analysis',
  peer_comparison: '5. Peer Comparison',
  rule_of_40: '6. Rule of 40',
  forward_ps: '7. Forward P/S',
  customer_concentration: '8. Customer Concentration',
  short_seller_perspective: '9. Short Seller Perspective',
  historical_ps: '10. Historical P/S',
  insider_ownership: '11. Insider Ownership',
  asymmetry_analysis: '12. Asymmetry Analysis',
  relative_strength: '13. Relative Strength',
  short_interest: '14. Short Interest',
  retail_sentiment: '15. Retail Sentiment',
  volume_patterns: '16. Volume Patterns',
  bull_case_critique: '17. Bull Case Critique',
  earnings_miss: '18. Earnings Miss',
  implied_volatility: '19. Implied Volatility',
  ai_verdict: 'Final Verdict',
};

const TIER_SECTIONS: Record<ResearchTier, string[]> = {
  basic: ['research_foundation', 'valuation_financials', 'risk_red_teaming', 'technicals'],
  decent: [
    'research_foundation', 'valuation_financials', 'risk_red_teaming', 'technicals',
    'peer_comparison', 'rule_of_40', 'forward_ps', 'customer_concentration',
    'short_seller_perspective', 'historical_ps', 'insider_ownership', 'asymmetry_analysis',
  ],
  indepth: [
    'research_foundation', 'valuation_financials', 'risk_red_teaming', 'technicals',
    'peer_comparison', 'rule_of_40', 'forward_ps', 'customer_concentration',
    'short_seller_perspective', 'historical_ps', 'insider_ownership', 'asymmetry_analysis',
    'relative_strength', 'short_interest', 'retail_sentiment', 'volume_patterns',
    'bull_case_critique', 'earnings_miss', 'implied_volatility',
  ],
};

export async function generateMarkdownReport(
  symbol: string,
  tier: ResearchTier
): Promise<string | null> {
  try {
    await ensureReportsDirectory();

    // Fetch summary data
    const summaryData = getCached(`summary:${symbol}`) as any;
    if (!summaryData) {
      console.error(`[markdown-report] No summary data found for ${symbol}`);
      return null;
    }

    const now = new Date();
    const meta: ReportMetadata = {
      symbol,
      companyName: summaryData.companyName ?? symbol,
      tier,
      timestamp: formatTimestamp(now),
      price: summaryData.price ?? 0,
    };

    // Build markdown content
    let markdown = generateHeader(meta);

    // Collect sections for this tier
    const sectionKeys = TIER_SECTIONS[tier];
    
    for (const sectionKey of sectionKeys) {
      const cacheKey = sectionKey === 'research_foundation' ? `foundation:${symbol}` :
                       sectionKey === 'valuation_financials' ? `valuation:${symbol}` :
                       sectionKey === 'risk_red_teaming' ? `risks:${symbol}` :
                       sectionKey === 'technicals' ? `technicals:${symbol}` :
                       `${sectionKey}:${symbol}`;
      
      const data = getCached(cacheKey);
      if (data) {
        const title = SECTION_TITLES[sectionKey] ?? sectionKey;
        markdown += formatSection(title, data as Record<string, unknown>);
      }
    }

    // Add verdict
    const verdictKey = `verdict:${symbol}:${tier}`;
    const verdictData = getCached(verdictKey);
    if (verdictData) {
      markdown += formatSection(SECTION_TITLES.ai_verdict, verdictData as Record<string, unknown>);
    }

    // Footer
    markdown += `---

*This report was automatically generated by AI. Please conduct your own due diligence before making investment decisions.*
`;

    // Write to file
    const dateStr = formatDate(now);
    const filename = `${symbol}_${dateStr}.md`;
    const filepath = path.join(REPORTS_DIR, filename);

    await fs.writeFile(filepath, markdown, 'utf8');
    console.log(`[markdown-report] Generated report: ${filepath}`);

    return filepath;
  } catch (err) {
    console.error(`[markdown-report] Failed to generate report for ${symbol}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
