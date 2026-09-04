// Serverless function για τις προτάσεις του LLM.
//
// Τρέχει στο Vercel, όχι στον browser. Ο λόγος είναι το κλειδί: αν η κλήση στο
// Gemini γινόταν από το frontend, το κλειδί θα φαινόταν στον κώδικα της σελίδας
// και ο καθένας θα μπορούσε να το χρησιμοποιήσει μέχρι να εξαντληθεί το όριο.
//
// Τρία επίπεδα προστασίας:
//   1. Το κλειδί μένει server-side, σε μεταβλητή περιβάλλοντος.
//   2. Κάθε αίτημα απαιτεί έγκυρο token Supabase. Χωρίς λογαριασμό, δεν περνάει.
//   3. Όριο χρήσης ανά χρήστη, ώστε ένας λογαριασμός να μη φάει το όριο όλων.

export const config = { runtime: 'edge' };

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Μέγιστα αιτήματα ανά χρήστη, ανά παράθυρο. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// Απλός μετρητής στη μνήμη. Επαρκεί για λίγους χρήστες. Αν μεγαλώσει η χρήση,
// αντικαθίσταται από πίνακα στη Supabase ή από Vercel KV.
const usage = new Map<string, { count: number; resetAt: number }>();

function withinLimit(userId: string): boolean {
  const now = Date.now();
  const entry = usage.get(userId);

  if (!entry || now > entry.resetAt) {
    usage.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;

  entry.count += 1;
  return true;
}

/** Επαληθεύει το token στη Supabase και επιστρέφει το id του χρήστη. */
async function verifyUser(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: header, apikey: anonKey },
  });
  if (!response.ok) return null;

  const user = (await response.json()) as { id?: string };
  return user.id ?? null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Δεν είναι σφάλμα: σημαίνει ότι το LLM δεν έχει ρυθμιστεί ακόμη.
    // Η εφαρμογή γυρνά στους τοπικούς κανόνες και ο χρήστης δεν βλέπει τίποτα.
    return json({ insights: [], reason: 'llm_not_configured' }, 200);
  }

  const userId = await verifyUser(request);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  if (!withinLimit(userId)) {
    return json({ error: 'rate_limited', retryAfterMinutes: 60 }, 429);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: {
          // Χαμηλή θερμοκρασία: θέλουμε συνέπεια, όχι δημιουργικότητα.
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[insights] Gemini error', response.status, detail.slice(0, 300));
      return json({ insights: [], reason: 'provider_error' }, 200);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Ακόμη και με responseMimeType JSON, ένα μοντέλο μπορεί να τυλίξει την
    // απάντηση σε backticks. Καθαρίζουμε πριν το parse.
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

    const parsed = JSON.parse(cleaned) as { insights?: unknown[] };
    if (!Array.isArray(parsed.insights)) throw new Error('missing insights array');

    return json({ insights: parsed.insights.slice(0, 3), source: 'llm' });
  } catch (error) {
    console.error('[insights] failure', error);
    // Ποτέ 500 προς το frontend: η εφαρμογή γυρνά ήσυχα στους τοπικούς κανόνες.
    return json({ insights: [], reason: 'parse_error' }, 200);
  }
}

/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `Είσαι οικονομικός σύμβουλος μέσα σε εφαρμογή προσωπικών οικονομικών.

ΚΑΝΟΝΕΣ:
1. ΜΗΝ κάνεις υπολογισμούς. Όλα τα ποσά σου δίνονται έτοιμα σε cents. Χρησιμοποίησέ τα αυτούσια.
2. Γράψε ΜΟΝΟ έγκυρο JSON, χωρίς markdown, χωρίς backticks, χωρίς εισαγωγικό κείμενο.
3. Το πολύ 3 προτάσεις. Λιγότερες είναι καλύτερα από αδύναμες.
4. Κάθε πρόταση πρέπει να αναφέρει συγκεκριμένη κατηγορία και συγκεκριμένο ποσό.
5. ΠΟΤΕ μην προτείνεις περικοπή σε κατηγορία με flexibility "fixed" ή userProtected true.
6. Μην δίνεις επενδυτικές συμβουλές, μην προτείνεις δάνεια, μην κρίνεις τον χρήστη.
7. Γράψε στη γλώσσα του πεδίου locale. Τόνος ήρεμος και πρακτικός, όχι ενθουσιώδης.
8. Αν τα δεδομένα δεν αρκούν για ασφαλές συμπέρασμα, γύρνα άδειο πίνακα insights.

ΣΧΗΜΑ ΑΠΑΝΤΗΣΗΣ:
{
  "insights": [
    {
      "type": "category_overspend" | "reallocation" | "positive_trend" | "goal_at_risk" | "cashflow_warning",
      "severity": "info" | "success" | "warning" | "critical",
      "title": "σύντομος τίτλος, έως 8 λέξεις",
      "body": "1-3 προτάσεις με συγκεκριμένα ποσά",
      "actions": [{ "categorySlug": "...", "deltaCents": 0 }],
      "confidence": 0.0
    }
  ]
}`;
