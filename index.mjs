const metaRegExpStr = '#(?<key>[a-z]+):(?<value>.+)';
const metaRowRegExp = new RegExp(metaRegExpStr, 'gi');
const metaRegExp = new RegExp(metaRegExpStr, 'i');
const ignoreKeys = /^(cover|video|encoding|background|start)$/i;
const numberKeys = /^(bpm|gap|year|end|videogap|previewstart)$/i;

const songRegExpStr = '(?<type>[:*F-])\\s(?<bpm_start>[0-9]+)(\\s(?<bpm_length>[0-9]+)\\s(?<pitch>[0-9-]+)\\s(?<text>.+))?';
const songRowRegExp = new RegExp(songRegExpStr, 'g');
const songRegExp = new RegExp(songRegExpStr);

const metaDataReducer = (result, row) =>
{
  let { key, value } = row.match(metaRegExp).groups;

  if (ignoreKeys.test(key)) return result;

  if (numberKeys.test(key))
  {
    value = parseFloat(value);

    if (value === 0)
    {
      return result;
    }
  }

  if (/language/i.test(key))
  {
    if (value in languageMap)
    {
      value = languageMap[value];
    }
    else
    {
      console.warn('Language ', value, 'is not mapped to a language code.');
    }
  }

  return {
    ...result,
    [key.toLowerCase()]: value,
  };
};

const typeMapping = {
  ':': 1, // 'REGULAR',
  '*': 2, // 'GOLDEN',
  'F': 0, // 'FREESTYLE',
};

const languageMap = {
  German: 'de',
  Deutsch: 'de',
  English: 'en',
  Englisch: 'en',
  Nederlands: 'nl',
  Dutch: 'nl',
};

export const getMetaData = content => content.match(metaRowRegExp).reduce(metaDataReducer, {});

export function getSongData(meta, content)
{
  if (/yes/i.test(meta.relative))
  {
    throw new Error('Parsing relative song files is not yet implemented!');
  }

  const bpmToMs = bpm => Math.round((250 / meta.bpm * 60) * parseInt(bpm, 10) * 100) / 100;
  const song = [];
  let lastLine;

  content.match(songRowRegExp).forEach((row) =>
  {
    const { type, bpm_start, bpm_length, pitch, text } = row.match(songRegExp).groups;
    const start = ((meta.videogap || 0) * 1000) + meta.gap + bpmToMs(bpm_start);
    const newLine = type === '-';

    if (!lastLine || newLine)
    {
      if (lastLine)
      {
        const linePitches = lastLine.syllables.map(syllable => syllable.pitch);
        lastLine.minPitch = Math.min(...linePitches);
        lastLine.maxPitch = Math.max(...linePitches);
        lastLine.end = start;

        if (newLine && !lastLine.syllables.length) return;
      }

      lastLine = { start, end: null, minPitch: null, maxPitch: null, syllables: [] };
      song.push(lastLine);

      if (newLine) return;
    }

    if (!lastLine.syllables.length && start - lastLine.start > 1000) {
      lastLine.start = start;
    }

    lastLine.syllables.push({
      type: typeMapping[type],
      start,
      length: bpm_length && bpmToMs(bpm_length),
      pitch: pitch && parseInt(pitch, 10),
      text,
    });
  });

  const lastSyllable = lastLine.syllables[lastLine.syllables.length - 1];
  const lastPitches = lastLine.syllables.map(syllable => syllable.pitch);
  lastLine.minPitch = Math.min(...lastPitches);
  lastLine.maxPitch = Math.max(...lastPitches);
  lastLine.end = lastSyllable.start + lastSyllable.length;

  return song;
}

export default function(content, { transformFields })
{
  const meta = getMetaData(content);

  if (transformFields)
  {
    for (const [field, transform] of Object.entries(transformFields))
    {
      meta[field] = transform(meta[field]);
    }
  }

  const song = getSongData(meta, content);

  return {
    ...meta,
    song,
  };
}