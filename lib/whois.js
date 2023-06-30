import whoiser from 'whoiser';

export default async function whois(domain) {
  return await whoiser(domain);
}

export async function isAvailable(domain) {
  //accept also subdomains
  if (domain.includes('.')) {
    domain = domain.split('.').slice(-2).join('.');
  }

  const domainWhois = await whoiser(domain, { follow: 1 });

  const firstDomainWhois = whoiser.firstResult(domainWhois);
  const firstTextLine = (firstDomainWhois.text[0] || '').toLowerCase();

  let domainAvailability = 'unknown';

  if (firstTextLine.includes('reserved')) {
    domainAvailability = 'reserved';
  } else if (
    firstDomainWhois['Domain Name'] &&
    firstDomainWhois['Domain Name'].toLowerCase() === domain
  ) {
    domainAvailability = 'registered';
  } else if (firstTextLine.includes(`no match for "${domain}"`)) {
    domainAvailability = 'available';
  }

  return domainAvailability;
}
