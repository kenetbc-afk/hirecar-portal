/**
 * Cloudflare Pages Function — Dispute Builder Bot (Governance Bot #12)
 * POST /api/dispute-builder
 *
 * Generates FCRA-compliant dispute letters from credit intake data.
 * Input: { memberId, bureau, items: [{ creditor, accountNumber, amount, type, reason }] }
 * Output: { letter: "...", items: [...], strategy: "..." }
 *
 * Brand voice: authoritative but accessible, professional mentor, 8th grade reading level.
 * Disclaimers: education/tools only, not legal or financial advice.
 */

const BUREAU_ADDRESSES = {
  equifax: {
    name: 'Equifax Information Services LLC',
    address: 'P.O. Box 740256\nAtlanta, GA 30374-0256',
  },
  experian: {
    name: 'Experian\nNational Consumer Assistance Center',
    address: 'P.O. Box 4500\nAllen, TX 75013',
  },
  transunion: {
    name: 'TransUnion LLC\nConsumer Dispute Center',
    address: 'P.O. Box 2000\nChester, PA 19016-2000',
  },
};

const DISPUTE_REASONS = {
  not_mine: {
    label: 'Not My Account',
    basis: 'FCRA Section 611(a)(1)(A) — This account does not belong to me. I have no knowledge of this account and have never entered into any agreement with the creditor listed.',
    strategy: 'Identity verification dispute — request full documentation including signed agreement.',
  },
  inaccurate_balance: {
    label: 'Inaccurate Balance',
    basis: 'FCRA Section 611(a)(1)(A) — The balance reported is inaccurate. The amount shown does not reflect actual payments made or the correct outstanding balance.',
    strategy: 'Balance verification — request itemized statement from date of last activity.',
  },
  paid_collection: {
    label: 'Paid Collection Still Reporting',
    basis: 'FCRA Section 611(a)(1)(A) — This collection account has been paid in full but continues to report as outstanding. This is inaccurate and should be updated or removed.',
    strategy: 'Paid status dispute — include proof of payment if available.',
  },
  late_payment_error: {
    label: 'Late Payment Error',
    basis: 'FCRA Section 611(a)(1)(A) — The late payment notation on this account is incorrect. My records indicate the payment was made on time.',
    strategy: 'Payment history dispute — reference bank statements or payment confirmation.',
  },
  unauthorized_inquiry: {
    label: 'Unauthorized Hard Inquiry',
    basis: 'FCRA Section 604 — This inquiry was made without my written authorization. I did not apply for credit with this entity.',
    strategy: 'Permissible purpose challenge — request proof of authorization.',
  },
  identity_theft: {
    label: 'Result of Identity Theft',
    basis: 'FCRA Section 605B — This account was opened as a result of identity theft. I am requesting immediate blocking of this information pursuant to Section 605B.',
    strategy: 'Identity theft dispute — include FTC Identity Theft Report and police report if available.',
  },
  obsolete: {
    label: 'Obsolete Information (7+ Years)',
    basis: 'FCRA Section 605(a) — This negative information is more than seven years old and should no longer be reported per the FCRA exclusion period.',
    strategy: 'Time-barred dispute — verify original delinquency date against 7-year window.',
  },
  duplicate: {
    label: 'Duplicate Account',
    basis: 'FCRA Section 611(a)(1)(A) — This account appears to be a duplicate listing of an account already reported. Only one entry should appear.',
    strategy: 'Duplicate detection — cross-reference account numbers and creditor names.',
  },
  medical_debt: {
    label: 'Medical Debt Under $500',
    basis: 'FCRA Section 605(a)(6) as amended — Medical collection debts under $500 should not appear on consumer credit reports per recent federal guidelines.',
    strategy: 'Medical debt exclusion — verify amount and medical provider status.',
  },
};

function generateLetter({ fname, lname, address, city, state, zip, ssn_last4, dob, bureau, items }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const bureauInfo = BUREAU_ADDRESSES[bureau] || BUREAU_ADDRESSES.equifax;

  const itemsBlock = items.map((item, i) => {
    const reason = DISPUTE_REASONS[item.reason] || DISPUTE_REASONS.not_mine;
    return `
ITEM ${i + 1}:
Creditor/Furnisher: ${item.creditor}
Account Number: ${item.accountNumber || 'Unknown'}
Reported Amount: ${item.amount ? '$' + Number(item.amount).toLocaleString() : 'Unknown'}
Reason for Dispute: ${reason.label}
Basis: ${reason.basis}
`;
  }).join('\n');

  return `${today}

${fname} ${lname}
${address || '[Your Address]'}
${city || '[City]'}, ${state || '[State]'} ${zip || '[ZIP]'}

${bureauInfo.name}
${bureauInfo.address}

RE: Formal Dispute of Inaccurate Information — FCRA Section 611

Dear ${bureauInfo.name.split('\n')[0]},

I am writing to formally dispute the following information appearing on my credit report, which I believe to be inaccurate, incomplete, or unverifiable. This dispute is made pursuant to my rights under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681i.

PERSONAL IDENTIFICATION:
Full Name: ${fname} ${lname}
Last 4 of SSN: ${ssn_last4 || 'XXXX'}
Date of Birth: ${dob || '[Date of Birth]'}

ITEMS DISPUTED:
${itemsBlock}
REQUESTED ACTION:

Pursuant to FCRA Section 611(a)(1)(A), I request that you conduct a reasonable investigation of each disputed item within 30 days of receipt of this letter. Under FCRA Section 611(a)(5)(A), if you cannot verify the accuracy of the disputed information, it must be promptly deleted or modified.

I also request that you provide me with:
1. The name, address, and telephone number of each furnisher contacted during the investigation
2. Written confirmation of the results within 5 business days of completion
3. A free copy of my updated credit report reflecting any corrections

Please note that pursuant to FCRA Section 611(a)(7), the disputed information must include a notation that it is disputed until the investigation is complete.

Enclosed: Copy of government-issued identification and proof of address.

Sincerely,

${fname} ${lname}

---
This letter was prepared using HIRECAR PIFR document preparation tools.
This is document preparation only — not legal advice.`;
}

export async function onRequestPost(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Content-Type': 'application/json',
  };

  try {
    const data = await context.request.json();

    if (!data.bureau || !data.items || !data.items.length) {
      return new Response(JSON.stringify({ error: 'Missing bureau or items' }), { status: 400, headers: cors });
    }

    const letter = generateLetter({
      fname: data.fname || '',
      lname: data.lname || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zip: data.zip || '',
      ssn_last4: data.ssn_last4 || '',
      dob: data.dob || '',
      bureau: data.bureau.toLowerCase(),
      items: data.items,
    });

    const itemStrategies = data.items.map(item => {
      const reason = DISPUTE_REASONS[item.reason] || DISPUTE_REASONS.not_mine;
      return {
        creditor: item.creditor,
        reason: reason.label,
        strategy: reason.strategy,
        basis: reason.basis,
      };
    });

    // Log to D1 if available
    if (context.env?.DB && data.memberId) {
      const id = 'disp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      try {
        await context.env.DB.prepare(
          'INSERT INTO pifr_activity_log (enrollment_id, action, actor, details) VALUES (?, ?, ?, ?)'
        ).bind(data.memberId, 'dispute_letter_generated', 'dispute-builder-bot', JSON.stringify({
          bureau: data.bureau, item_count: data.items.length
        })).run();
      } catch (e) {
        console.error('D1 log error:', e.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      letter: letter,
      strategies: itemStrategies,
      bureau: data.bureau,
      itemCount: data.items.length,
      disclaimer: 'This is document preparation only — not legal advice. HIRECAR provides FCRA-compliant dispute letter templates as an educational tool.',
    }), { headers: cors });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}

export async function onRequestGet(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  // Return available dispute reasons
  return new Response(JSON.stringify({
    reasons: Object.entries(DISPUTE_REASONS).map(([id, r]) => ({
      id, label: r.label, strategy: r.strategy,
    })),
    bureaus: Object.keys(BUREAU_ADDRESSES),
  }), { headers: cors });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    },
  });
}
