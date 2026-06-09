'use strict';

// Pure scoring function for scholarship recommendations. Kept side-effect free
// and dependency-free so it can be unit-tested in isolation.
//
// Inputs:
//   scholarship — plain object (or Mongoose doc) with: countries[], grades[],
//                 fields[], tags[], deadline, active
//   profile     — { nationality, education, bio }
//
// Output:
//   { score, reasons[] } — score is an unbounded non-negative number; reasons
//   is a small array of short human-readable strings the UI can render as chips.

const MAX_INTEREST_HITS = 4;
const MAX_INTEREST_BONUS = 20;
const POINTS_PER_INTEREST = 5;

const normalize = (value) => String(value || '').toLowerCase().trim();
const normalizeList = (list) =>
    (Array.isArray(list) ? list : []).map(normalize).filter(Boolean);

const scoreScholarship = (scholarship, profile) => {
    const reasons = [];
    let score = 0;

    const countries = normalizeList(scholarship && scholarship.countries);
    const grades = normalizeList(scholarship && scholarship.grades);
    const fields = normalizeList(scholarship && scholarship.fields);
    const tags = normalizeList(scholarship && scholarship.tags);

    const nationality = normalize(profile && profile.nationality);
    const education = normalize(profile && profile.education);
    const bio = normalize(profile && profile.bio);

    // Country match -----------------------------------------------------------
    if (countries.length === 0) {
        score += 10;
        reasons.push('Open globally');
    } else if (nationality && countries.includes(nationality)) {
        score += 30;
        // Use the raw casing for display where possible.
        const original = (scholarship.countries || []).find(
            (c) => normalize(c) === nationality
        );
        reasons.push(`Open to ${original || nationality}`);
    }

    // Education level match ---------------------------------------------------
    if (education && grades.length) {
        const hit = grades.find((g) => education.includes(g) || g.includes(education));
        if (hit) {
            score += 25;
            reasons.push(`Matches ${hit}`);
        }
    } else if (grades.length === 0) {
        // No restrictions — treat as a mild positive.
        score += 5;
    }

    // Interest overlap with bio ----------------------------------------------
    const interests = Array.from(new Set([...fields, ...tags])).filter(
        (token) => token.length >= 3
    );
    const matched = [];
    if (bio) {
        for (const token of interests) {
            if (bio.includes(token)) {
                matched.push(token);
                if (matched.length >= MAX_INTEREST_HITS) break;
            }
        }
    }
    if (matched.length) {
        score += Math.min(matched.length * POINTS_PER_INTEREST, MAX_INTEREST_BONUS);
        reasons.push(`Interests: ${matched.slice(0, 3).join(', ')}`);
    }

    // Deadline freshness ------------------------------------------------------
    if (scholarship && scholarship.deadline) {
        const ms = new Date(scholarship.deadline).getTime() - Date.now();
        if (Number.isFinite(ms) && ms > 7 * 24 * 60 * 60 * 1000) {
            score += 5;
        }
    } else {
        // Rolling deadline.
        score += 5;
    }

    return { score, reasons };
};

// Normalise a score (0..~85) into a 0..100 percentage for UI display.
const MAX_SCORE = 85;
const toPercent = (score) =>
    Math.max(0, Math.min(100, Math.round((score / MAX_SCORE) * 100)));

// Rank scholarships against a profile. Drops zero-score items so the UI never
// shows a meaningless recommendation. Sort: score desc, then deadline asc
// (rolling deadlines last).
const rankScholarships = (scholarships, profile, limit = 10) => {
    const list = Array.isArray(scholarships) ? scholarships : [];
    const scored = list
        .map((scholarship) => {
            const { score, reasons } = scoreScholarship(scholarship, profile);
            return { scholarship, score, reasons, matchPercent: toPercent(score) };
        })
        .filter((entry) => entry.score > 0);

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ad = a.scholarship.deadline ? new Date(a.scholarship.deadline).getTime() : Infinity;
        const bd = b.scholarship.deadline ? new Date(b.scholarship.deadline).getTime() : Infinity;
        return ad - bd;
    });

    const cap = Math.max(1, Math.min(50, Number(limit) || 10));
    return scored.slice(0, cap);
};

module.exports = { scoreScholarship, rankScholarships, toPercent };
