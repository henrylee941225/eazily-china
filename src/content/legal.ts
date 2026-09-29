// Legal documents — generated from the approved Word documents dated 22 July 2026.
// Do not edit copy here without updating the source documents and the lastUpdated date.

export type LegalSection = {
  heading?: string;
  subheading?: string;
  paragraphs: string[]; // items beginning with "- " render as bullet list items
};

export type LegalDocument = {
  slug: "privacy" | "terms" | "cookies";
  title: string;
  lastUpdated: string; // display string
  version: string;
  sections: LegalSection[];
};

export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  lastUpdated: "22 July 2026",
  version: "1.0",
  sections: [
  {
    paragraphs: [
      "This Privacy Notice for EAZILYCHINA LTD ('we', 'us', or 'our') describes how and why we might access, collect, store, use, and/or share ('process') your personal information when you use our services ('Services'), including when you:",
      "- Visit our website at https://eazilychina.com/, or any website of ours that links to this Privacy Notice",
      "- Download and use our mobile application (eazilyChina), or any other application of ours that links to this Privacy Notice",
      "- Engage with us in other related ways, including any marketing or events",
      "Questions or concerns? Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at andrea@eazilychina.com."
    ]
  },  {
    heading: "SUMMARY OF KEY POINTS",
    paragraphs: [
      "- What personal information do we process? Account details (name, email, phone), your trip details and preferences, booking requests you make, and payment-related information handled by our payment processor. See Section 1.",
      "- Do we process any sensitive personal information? We do not process special-category data. If a service you request requires identity documents (for example, real-name ticketing in China may require passport details), we will tell you at the point of collection, use those details only to fulfil that request, and share them only with the relevant fulfilment partner. See Section 1.",
      "- Do we collect any information from third parties? We do not collect any information from third parties.",
      "- How do we process your information? To provide, improve, and administer the Services, to fulfil the bookings and services you request, to communicate with you, for security and fraud prevention, and to comply with law. See Section 2.",
      "- When do we share personal information? With the service providers and fulfilment partners needed to deliver what you request — for example our payment processor, AI service providers, and the drivers or venues fulfilling your booking. See Section 4.",
      "- How do we keep your information safe? We have organisational and technical processes in place, but no electronic transmission or storage can be guaranteed 100% secure. See Section 8.",
      "- What are your rights? Depending on where you are located, applicable privacy law may give you rights regarding your personal information. See Section 10.",
      "- How do you exercise your rights? Contact us at andrea@eazilychina.com. We will consider and act upon any request in accordance with applicable data protection laws."
    ]
  },  {
    heading: "1. WHAT INFORMATION DO WE COLLECT?",
    paragraphs: [
      
    ]
  },  {
    subheading: "Personal information you disclose to us",
    paragraphs: [
      "In Short: We collect personal information that you provide to us.",
      "We collect personal information that you voluntarily provide when you register on the Services, use our features, make a booking or purchase, or otherwise contact us. Depending on how you use the Services, this may include:",
      "- names",
      "- phone numbers",
      "- email addresses",
      "- passwords and authentication data",
      "- trip details (arrival and departure dates, destination city)",
      "- preferences (for example your preferred currency, dining preferences and tastes you choose to share)",
      "- booking details you submit (for example pickup addresses, flight or train numbers, party size, and requests you send to our concierge team)",
      "Identity documents for specific services. We do not routinely collect identity documents. Certain services in mainland China operate real-name systems (for example rail tickets and some attraction tickets). If you ask us to arrange such a service, we will tell you what is required (typically passport name, number, and nationality), use it solely to fulfil that request, share it only with the relevant fulfilment partner or official booking channel, and retain it no longer than necessary for the booking and our legal obligations.",
      "Payment Data. We may collect data necessary to process your payment if you choose to make purchases. All payment data is handled and stored by Stripe. You may find their privacy notice here: https://stripe.com/gb/privacy. We do not store your full card number on our systems."
    ]
  },  {
    subheading: "Information automatically collected",
    paragraphs: [
      "In Short: Some information — such as your Internet Protocol (IP) address and/or device characteristics — is collected automatically when you use our Services.",
      "We automatically collect certain technical information when you use the Services. This does not reveal your specific identity but may include IP address, device and browser characteristics, operating system, language preferences, and information about how and when you use the Services. This information is needed to maintain the security and operation of the Services and for internal analytics and reporting. Like many businesses, we also use strictly necessary storage technologies as described in our Cookie Policy.",
      "- Log and Usage Data: diagnostic, usage, and performance information our servers collect when you use the Services (for example date/time stamps, features used, and error reports).",
      "- Device Data: information about the phone, tablet, or computer you use (for example device identifiers, browser type, operating system, and mobile carrier).",
      "- Location Data: we look up locations you search for and, with your permission, may use your device's location to centre maps and provide directions. You can disable location access in your device settings; some map features may then not work."
    ]
  },  {
    heading: "2. HOW DO WE PROCESS YOUR INFORMATION?",
    paragraphs: [
      "In Short: We process your information to provide, improve, and administer our Services, fulfil the bookings you request, communicate with you, for security and fraud prevention, and to comply with law.",
      "- To facilitate account creation and authentication and otherwise manage user accounts.",
      "- To deliver the services you request — including passing your booking details to the driver, venue, or fulfilment partner needed to complete your booking.",
      "- To respond to your enquiries and provide support, including through our concierge team.",
      "- To send administrative information, such as booking confirmations and changes to our terms and policies.",
      "- To fulfil and manage your orders, payments, and refunds made through the Services.",
      "- To save or protect an individual's vital interest, such as to prevent harm."
    ]
  },  {
    heading: "3. WHAT LEGAL BASES DO WE RELY ON TO PROCESS YOUR INFORMATION?",
    paragraphs: [
      "In Short: We only process your personal information when we have a valid legal basis to do so under applicable law.",
      "If you are located in the EU or UK, the General Data Protection Regulation (GDPR) and UK GDPR require us to explain the legal bases we rely on:",
      "- Consent. Where you have given us permission for a specific purpose. You can withdraw consent at any time (see Section 10).",
      "- Performance of a Contract. Where processing is necessary to provide the Services you have requested — this is our main basis for account management, bookings, and payments.",
      "- Legal Obligations. Where processing is necessary to comply with law, such as tax and accounting requirements or cooperation with law enforcement.",
      "- Legitimate Interests. Where processing is necessary for our legitimate business interests (such as securing and improving the Services) and does not override your rights.",
      "- Vital Interests. Where necessary to protect your vital interests or those of another person."
    ]
  },  {
    heading: "4. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?",
    paragraphs: [
      "In Short: We share information only with the categories of third parties needed to run the Services and fulfil your requests. We do not sell your personal information, and we do not share it with advertising networks.",
      "We may share your data with third-party vendors, service providers, and fulfilment partners who perform services for us or on our behalf and need access to the information to do that work. We have contracts in place designed to safeguard your personal information. The categories are:",
      "- Payment Processors (Stripe) — to process payments, authorisations, and refunds.",
      "- AI Service Providers — to power AI features, as described in Section 6.",
      "- Cloud Computing and Data Storage Providers — to host the Services and store data.",
      "- Email and Communication Delivery Providers — to send transactional messages such as booking notifications.",
      "- Fulfilment Partners — the third parties who deliver what you book: for example our driver-service partner receives the passenger name, contact number, pickup details, and flight number for a transfer you book; a restaurant receives the reservation name, party size, and time for a table we book on your behalf.",
      "- Maps and Routing Providers — when you search for a place or request a route, the search terms and relevant coordinates are processed by Apple Maps (MapKit) and, for routing within mainland China, AutoNavi (Amap). These lookups are made to provide the map feature and are not used by us for advertising.",
      "- Website Hosting and Product Engineering Providers — to build, host, and maintain the Services.",
      "We may also need to share personal information in connection with a business transfer, such as a merger, sale of company assets, financing, or acquisition of all or a portion of our business."
    ]
  },  {
    heading: "5. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?",
    paragraphs: [
      "In Short: We use strictly necessary and functional storage technologies. We do not use advertising or cross-site tracking cookies.",
      "We use cookies and similar technologies (such as browser local storage and service worker caching) to keep you signed in, remember your preferences, maintain security, prevent fraud, and make the app work reliably. Our payment processor, Stripe, sets cookies necessary for secure checkout and fraud prevention. We do not permit third parties to use tracking technologies on our Services for advertising, and we do not use retargeting or advertising networks. Specific information about the technologies we use and how you can control them is set out in our Cookie Policy."
    ]
  },  {
    heading: "6. DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?",
    paragraphs: [
      "In Short: We offer features powered by artificial intelligence, provided through third-party AI service providers.",
      "As part of our Services, we offer features powered by artificial intelligence ('AI Products'), including AI-assisted translation, our concierge assistant, itinerary planning, and recommendations. We provide the AI Products through third-party AI service providers ('AI Service Providers'). Our current AI Service Provider is DeepSeek. Your inputs to AI features (such as messages and translation text) and relevant context are shared with and processed by the AI Service Provider to provide the feature. We may change AI Service Provider; if we do, we will update this Privacy Notice. You must not use the AI Products in any way that violates the terms or policies of any AI Service Provider. All personal information processed using our AI Products is handled in line with this Privacy Notice."
    ]
  },  {
    heading: "7. HOW LONG DO WE KEEP YOUR INFORMATION?",
    paragraphs: [
      "In Short: We keep your information for as long as necessary to fulfil the purposes outlined in this Privacy Notice unless otherwise required by law.",
      "We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period in which you have an account with us, plus any period required by law. When we have no ongoing legitimate business need to process your personal information, we will delete or anonymise it, or, if this is not possible (for example, because it is stored in backup archives), we will securely store it and isolate it from further processing until deletion is possible."
    ]
  },  {
    heading: "8. HOW DO WE KEEP YOUR INFORMATION SAFE?",
    paragraphs: [
      "In Short: We aim to protect your personal information through a system of organisational and technical security measures.",
      "We have implemented appropriate and reasonable technical and organisational security measures designed to protect the security of any personal information we process. However, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise that hackers, cybercriminals, or other unauthorised third parties will not be able to defeat our security. Transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment."
    ]
  },  {
    heading: "9. DO WE COLLECT INFORMATION FROM MINORS?",
    paragraphs: [
      "In Short: We do not knowingly collect data from or market to children under 18 years of age.",
      "We do not knowingly collect, solicit data from, or market to children under 18 years of age (or the equivalent age specified by law in your jurisdiction). By using the Services, you represent that you are at least 18. If we learn that personal information from users under 18 has been collected, we will deactivate the account and take reasonable measures to promptly delete the data. If you become aware of any data we may have collected from children under 18, please contact us at andrea@eazilychina.com."
    ]
  },  {
    heading: "10. WHAT ARE YOUR PRIVACY RIGHTS?",
    paragraphs: [
      "In Short: Depending on where you live, you have rights that allow you greater access to and control over your personal information.",
      "In some regions (like the EEA, UK, and Switzerland), you have rights under applicable data protection laws, which may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure, (iii) to restrict processing, (iv) to data portability, and (v) not to be subject to automated decision-making. In certain circumstances you may also have the right to object to processing. You can make a request by contacting us using the details in Section 13. We will consider and act upon any request in accordance with applicable data protection laws.",
      "If you are located in the UK and are unhappy with how we have handled your personal information, you can complain directly to us. We will acknowledge your complaint within 30 days, investigate without undue delay, and explain the outcome. If you are not happy with our final response, you can refer your complaint to the Information Commissioner's Office (ICO), the UK supervisory authority: ico.org.uk/make-a-complaint · 0303 123 1113 · Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF. If you are in the EEA, you may complain to your Member State data protection authority; in Switzerland, to the Federal Data Protection and Information Commissioner.",
      "Withdrawing your consent: Where we rely on your consent, you may withdraw it at any time by contacting us. This will not affect the lawfulness of processing before withdrawal.",
      "Opting out of marketing: You can unsubscribe from marketing communications at any time via the unsubscribe link in our emails or by contacting us. We may still send you service-related messages necessary for the administration of your account and bookings."
    ]
  },  {
    subheading: "Account Information",
    paragraphs: [
      "If you would like to review or change the information in your account or terminate your account, you can log in to your account settings and update your account, or contact us. Upon a termination request, we will deactivate or delete your account and information from our active databases, although we may retain some information to prevent fraud, troubleshoot problems, assist with investigations, enforce our legal terms, and/or comply with legal requirements."
    ]
  },  {
    heading: "11. CONTROLS FOR DO-NOT-TRACK FEATURES",
    paragraphs: [
      "Most web browsers and some mobile operating systems include a Do-Not-Track ('DNT') feature. No uniform technology standard for recognising and implementing DNT signals has been finalised, and we do not currently respond to DNT browser signals. If a standard is adopted that we must follow, we will inform you in a revised version of this Privacy Notice. We note for completeness that we do not use cross-site tracking in any event."
    ]
  },  {
    heading: "12. DO WE MAKE UPDATES TO THIS NOTICE?",
    paragraphs: [
      "In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws.",
      "We may update this Privacy Notice from time to time. The updated version will be indicated by an updated 'Last updated' date at the top. If we make material changes, we may notify you by prominently posting a notice or by sending you a notification. We encourage you to review this Privacy Notice frequently."
    ]
  },  {
    heading: "13. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?",
    paragraphs: [
      "If you have questions or comments about this notice, you may email us at andrea@eazilychina.com or contact us by post at:",
      "EAZILYCHINA LTD, Tms House, Cray Avenue, Orpington, England BR5 3QB, United Kingdom"
    ]
  },  {
    heading: "14. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?",
    paragraphs: [
      "Based on the applicable laws of your country, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing. To exercise these rights, email us at andrea@eazilychina.com and we will respond in accordance with applicable data protection laws."
    ]
  }
  ]
};

export const TERMS_AND_CONDITIONS: LegalDocument = {
  slug: "terms",
  title: "Terms & Conditions",
  lastUpdated: "27 July 2026",
  version: "1.1",
  sections: [
  {
    heading: "AGREEMENT TO OUR LEGAL TERMS",
    paragraphs: [
      "We are EAZILYCHINA LTD ('Company', 'we', 'us', or 'our'), a company registered in the United Kingdom at Tms House, Cray Avenue, Orpington, England BR5 3QB.",
      "We operate the website https://eazilychina.com (the 'Site'), the mobile application eazilyChina (the 'App'), as well as any other related products and services that refer or link to these legal terms (the 'Legal Terms') (collectively, the 'Services').",
      "You can contact us by email at andrea@eazilychina.com, or by mail to Tms House, Cray Avenue, Orpington, England BR5 3QB, United Kingdom.",
      "These Legal Terms constitute a legally binding agreement made between you ('you') and EAZILYCHINA LTD concerning your access to and use of the Services. By accessing the Services, you confirm that you have read, understood, and agreed to be bound by all of these Legal Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, YOU MUST NOT USE THE SERVICES.",
      "We will provide you with prior notice of any scheduled changes to the Services you are using. The modified Legal Terms will become effective upon posting or notifying you. By continuing to use the Services after the effective date of any changes, you agree to be bound by the modified terms.",
      "The Services are intended for users who are at least 18 years old. Persons under the age of 18 are not permitted to use or register for the Services."
    ]
  },  {
    heading: "1. OUR SERVICES",
    paragraphs: [
      
    ]
  },  {
    subheading: "What eazilyChina is",
    paragraphs: [
      "eazilyChina is a travel companion app for visitors to mainland China. The Services include free features (such as guides, our venue directory, maps, and translation) and paid features (such as our concierge service and private transfer bookings)."
    ]
  },  {
    subheading: "How our concierge and bookings work",
    paragraphs: [
      "When you ask us to arrange something — for example a restaurant reservation or a private airport transfer — we act as an intermediary and booking agent on your behalf. Bookings are fulfilled by our operations team and third-party fulfilment partners (for example restaurants, venues, and a third-party driver service). The restaurant, venue, or driver providing the underlying service is a third party and is not owned or operated by us. We use reasonable care in selecting and working with fulfilment partners, but the underlying service (the meal, the journey, the event) is provided by that third party.",
      "A booking request is not a confirmed booking. Your booking is confirmed only when we tell you so in the App. Where a request cannot be fulfilled, we will tell you in the App and any payment will be handled as described in Section 7."
    ]
  },  {
    subheading: "Information in the App",
    paragraphs: [
      "We work to keep venue information, guides, and recommendations accurate and grounded in verified sources, but details such as opening hours, prices, and availability are controlled by third parties and can change without notice. Where we have not been able to verify a detail, the App says so (for example, 'check hours before visiting'). Content in the App is provided for general guidance and is not a guarantee of availability or a substitute for official information (for example visa rules, which you should verify with official government sources)."
    ]
  },  {
    subheading: "Jurisdictional note",
    paragraphs: [
      "The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction where such distribution or use would be contrary to law or regulation. Persons who access the Services from other locations do so on their own initiative and are responsible for compliance with local laws."
    ]
  },  {
    heading: "2. INTELLECTUAL PROPERTY RIGHTS",
    paragraphs: [
      
    ]
  },  {
    subheading: "Our intellectual property",
    paragraphs: [
      "We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, designs, text, and graphics (the 'Content'), and the trademarks and logos contained therein (the 'Marks'). The Content and Marks are provided 'AS IS' for your personal, non-commercial use only."
    ]
  },  {
    subheading: "Your use of our Services",
    paragraphs: [
      "Subject to your compliance with these Legal Terms, we grant you a non-exclusive, non-transferable, revocable licence to access the Services and to download or print a copy of any portion of the Content to which you have properly gained access, solely for your personal, non-commercial use. No part of the Services, Content, or Marks may be copied, reproduced, republished, sold, licensed, or otherwise exploited for any commercial purpose without our express prior written permission. We reserve all rights not expressly granted. Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately."
    ]
  },  {
    subheading: "Your submissions",
    paragraphs: [
      "By sending us any question, comment, suggestion, idea, feedback, or other information about the Services ('Submissions'), you agree to assign to us all intellectual property rights in such Submission and that we shall be entitled to its unrestricted use for any lawful purpose without compensation to you. You confirm that your Submissions comply with the 'Prohibited Activities' section, are original to you or properly licensed, and do not constitute confidential information. You are solely responsible for your Submissions."
    ]
  },  {
    heading: "3. USER REPRESENTATIONS",
    paragraphs: [
      "By using the Services, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information; (3) you have the legal capacity and agree to comply with these Legal Terms; (4) you are not a minor in the jurisdiction in which you reside; (5) you will not access the Services through automated or non-human means; (6) you will not use the Services for any illegal or unauthorised purpose; and (7) your use of the Services will not violate any applicable law or regulation, including the laws applicable in the destinations you travel to."
    ]
  },  {
    heading: "4. USER REGISTRATION",
    paragraphs: [
      "You may be required to register to use the Services. You are responsible for all use of your account and for keeping your sign-in credentials secure. We reserve the right to remove, reclaim, or change a username if we determine it is inappropriate, obscene, or otherwise objectionable."
    ]
  },  {
    heading: "5. PURCHASES AND PAYMENT",
    paragraphs: [
      "Payments are processed by Stripe. We accept major payment methods supported by Stripe checkout, including Visa, Mastercard, American Express, Apple Pay, and Google Pay.",
      "Prices are quoted in the App. Where you have chosen a preferred currency, the charge amount in your currency is calculated and locked at the time of your booking or purchase using our exchange-rate mechanism (which may include a currency conversion margin), and the locked amount is the amount charged. The App shows you the exact amount you will be charged before you pay. Prices shown are inclusive of applicable taxes unless stated otherwise.",
      "You agree to provide current, complete, and accurate purchase information, and you authorise us (via Stripe) to charge or place an authorisation hold on your chosen payment method for the amounts shown. We reserve the right to correct any errors or mistakes in pricing, even if we have already requested or received payment, and to refuse or cancel any order, including where we suspect fraud or misuse."
    ]
  },  {
    heading: "6. TRIP PASS",
    paragraphs: [
      "The Trip Pass is a one-off purchase — not a subscription and it does not auto-renew.",
      "- What it unlocks: unlimited restaurant booking requests, our concierge assistant, itinerary planning, and personalised recommendations for the duration of your pass, with priority handling of your requests.",
      "- First booking free: your first restaurant booking request does not require a Trip Pass.",
      "- Validity: the Trip Pass is valid for the trip dates you enter at purchase, up to a maximum of 60 days, and expires at the end of your trip end date (with a short operational grace period). It does not extend if you change your trip dates after purchase; if your plans change materially, contact us through the App and we will try to help.",
      "- Free features: maps, translation, guides, and our venue directory do not require a Trip Pass. Private transfers are booked and paid separately and do not require a Trip Pass.",
      "- Availability of underlying services: the Trip Pass unlocks the ability to make requests; individual bookings remain subject to real-world availability.",
      "Immediate supply and cancellation right: the Trip Pass activates immediately on purchase. By purchasing, you expressly request immediate supply of this digital service and acknowledge that you lose your statutory right to cancel under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 once supply has begun. Except as set out in Section 7 or as required by law, the Trip Pass is non-refundable."
    ]
  },  {
    heading: "7. REFUNDS AND CANCELLATIONS",
    paragraphs: [
      "This section replaces any suggestion elsewhere that all sales are final. Your statutory rights are not affected."
    ]
  },  {
    subheading: "Private transfers",
    paragraphs: [
      "- When you book a transfer with a pickup in the near term, your card is authorised (a hold is placed) at booking and only charged when we confirm your driver. If we cannot confirm a driver, the hold is released and you pay nothing.",
      "- When you book a transfer with a pickup further in the future, your card is charged at booking (card authorisations cannot be held that long). If we cannot confirm your transfer, you receive a full refund, which typically appears within 5–10 working days.",
      "- If you cancel before your transfer is confirmed, any hold is released or any payment is refunded in full.",
      "- Once a transfer is confirmed, you can cancel free of charge in the App up to 24 hours before your scheduled pickup, and any hold will be released or payment refunded in full. Within 24 hours of pickup, cancellation is no longer available in the App; you can message our team from your booking and we will try to help, but at that stage any refund is at our discretion, reflecting costs already committed to the driver. Changes can be requested in the App at any time before pickup.",
      "- If a payment is captured in error or after a booking has expired, we will resolve it, including refunding where appropriate."
    ]
  },  {
    subheading: "Restaurant bookings",
    paragraphs: [
      "We do not charge for making a restaurant booking request itself (beyond the Trip Pass where applicable). Any amounts you spend at the restaurant are paid by you directly to the restaurant and are a matter between you and the restaurant."
    ]
  },  {
    subheading: "Trip Pass",
    paragraphs: [
      "The Trip Pass is non-refundable once activated, except where we have failed to provide the service or where a refund is required by law. If something has gone wrong, contact us at andrea@eazilychina.com and we will review it."
    ]
  },  {
    heading: "8. PROHIBITED ACTIVITIES",
    paragraphs: [
      "You may not access or use the Services for any purpose other than that for which we make the Services available. As a user of the Services, you agree not to:",
      "- Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.",
      "- Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.",
      "- Circumvent, disable, or otherwise interfere with security-related features of the Services, including any feature that restricts access to paid features or enforces entitlements.",
      "- Use the Services to make fraudulent bookings or purchases, or bookings you do not intend to honour.",
      "- Use any information obtained from the Services in order to harass, abuse, or harm another person, including our staff, fulfilment partners, and drivers.",
      "- Make improper use of our support or concierge services or submit false reports of abuse or misconduct.",
      "- Use the Services in a manner inconsistent with any applicable laws or regulations.",
      "- Upload or transmit viruses, Trojan horses, or other malicious material, or interfere with the operation of the Services.",
      "- Engage in any automated use of the system, such as using scripts, bots, or data-mining tools.",
      "- Attempt to impersonate another user or person.",
      "- Interfere with, disrupt, or create an undue burden on the Services or connected networks.",
      "- Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising the Services.",
      "- Use the Services as part of any effort to compete with us or for any unauthorised commercial enterprise."
    ]
  },  {
    heading: "9. USER SUBMISSIONS AND MESSAGES",
    paragraphs: [
      "The Services allow you to send messages and requests to our team (for example through the concierge chat) and to submit information needed for bookings. You are responsible for what you send. You must not send anything illegal, harassing, hateful, defamatory, obscene, threatening, or misleading. We may review messages to provide the service, ensure safety, and improve quality. We may access, store, process, and use any information and personal data that you provide following the terms of the Privacy Policy and your choices. By submitting suggestions or feedback, you agree that we can use such feedback for any purpose without compensation to you."
    ]
  },  {
    heading: "10. MOBILE APPLICATION LICENCE",
    paragraphs: [
      
    ]
  },  {
    subheading: "Use Licence",
    paragraphs: [
      "If you access the Services via the App, we grant you a revocable, non-exclusive, non-transferable, limited right to install and use the App on devices owned or controlled by you, strictly in accordance with these Legal Terms. You shall not: (1) except as permitted by applicable law, decompile, reverse engineer, disassemble, attempt to derive the source code of, or decrypt the App; (2) make any modification, adaptation, or derivative work from the App; (3) violate any applicable laws in connection with your use of the App; (4) remove or obscure any proprietary notice; (5) use the App for any revenue-generating endeavour or purpose for which it is not designed; (6) make the App available over a network permitting simultaneous use by multiple devices or users; (7) use the App to create a competing product or service; (8) use the App to send automated queries or unsolicited commercial email; or (9) use our proprietary information or interfaces in the design or development of any other application or device."
    ]
  },  {
    subheading: "Apple and Android Devices",
    paragraphs: [
      "The following terms apply when you use the App obtained from either the Apple App Store or Google Play (each an 'App Distributor'): (1) the licence granted to you is limited to a non-transferable licence to use the App on a device that utilises the Apple iOS or Android operating system, in accordance with the App Distributor's terms of service; (2) we are responsible for providing maintenance and support for the App as specified in these Legal Terms or as required under applicable law, and each App Distributor has no obligation to furnish any maintenance and support; (3) in the event of any failure of the App to conform to any applicable warranty, you may notify the App Distributor, which may refund any purchase price paid for the App, and, to the maximum extent permitted by law, the App Distributor will have no other warranty obligation; (4) you represent that you are not located in a country subject to a US government embargo or designated as 'terrorist supporting', and that you are not listed on any US government list of prohibited or restricted parties; (5) you must comply with applicable third-party terms when using the App; and (6) the App Distributors are third-party beneficiaries of this mobile application licence and may enforce it against you."
    ]
  },  {
    heading: "11. SERVICES MANAGEMENT",
    paragraphs: [
      "We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who violates the law or these Legal Terms; (3) refuse, restrict access to, or limit the availability of the Services or any portion thereof; and (4) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services."
    ]
  },  {
    heading: "12. PRIVACY POLICY",
    paragraphs: [
      "We care about data privacy and security. Please review our Privacy Policy. By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into these Legal Terms. The Services are hosted on infrastructure within the European Union. If you access the Services from a region with laws governing personal data that differ from EU/UK law, you are transferring your data to the EU/UK and consent to such transfer and processing. Where fulfilment of your booking requires it, limited booking details are shared with fulfilment partners in the destination country, as described in the Privacy Policy."
    ]
  },  {
    heading: "13. TERM AND TERMINATION",
    paragraphs: [
      "These Legal Terms remain in force while you use the Services. We reserve the right, in our sole discretion and without liability, to deny access to and use of the Services to any person for breach of these Legal Terms or applicable law, and to terminate your account. Where reasonably practicable we will give you notice and, if you have an active paid service, handle any amounts paid fairly and in accordance with Section 7 and applicable law. If we terminate or suspend your account for breach, you may not register a new account under your own or any other name."
    ]
  },  {
    heading: "14. MODIFICATIONS AND INTERRUPTIONS",
    paragraphs: [
      "We reserve the right to change, modify, or remove the contents of the Services at any time at our sole discretion, and to modify or discontinue all or part of the Services. We cannot guarantee the Services will be available at all times; we may experience problems or need to perform maintenance resulting in interruptions, delays, or errors. We will not be liable for any loss caused by your inability to access or use the Services during downtime, except as set out in Section 18 and as required by law. This does not affect refunds due under Section 7."
    ]
  },  {
    heading: "15. GOVERNING LAW",
    paragraphs: [
      "These Legal Terms are governed by and interpreted following the laws of England and Wales, and the use of the United Nations Convention on Contracts for the International Sale of Goods is expressly excluded. If your habitual residence is in the EU and you are a consumer, you additionally possess the protection provided to you by obligatory provisions of the law of your country of residence. EAZILYCHINA LTD and you both agree to submit to the non-exclusive jurisdiction of the courts of England and Wales, which means that you may make a claim to defend your consumer protection rights in the UK or in the EU country in which you reside."
    ]
  },  {
    heading: "16. DISPUTE RESOLUTION",
    paragraphs: [
      "If you have a problem, contact us first at andrea@eazilychina.com and we will try to resolve it. The European Commission provides information on consumer redress, including a list of dispute resolution bodies by country. UK consumers may also have recourse to alternative dispute resolution schemes; details available on request."
    ]
  },  {
    heading: "17. CORRECTIONS",
    paragraphs: [
      "There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, and availability. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update information at any time, without prior notice."
    ]
  },  {
    heading: "18. DISCLAIMER AND LIMITATIONS OF LIABILITY",
    paragraphs: [
      "THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES' CONTENT. THE UNDERLYING SERVICES YOU BOOK (SUCH AS MEALS, VENUES, AND JOURNEYS) ARE PROVIDED BY THIRD PARTIES, AND WE ARE NOT RESPONSIBLE FOR THE ACTS OR OMISSIONS OF THOSE THIRD PARTIES, ALTHOUGH WE WILL ASSIST YOU IN GOOD FAITH WHERE SOMETHING GOES WRONG.",
      "TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU FOR ANY INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, OR LOSS OF DATA, ARISING FROM YOUR USE OF THE SERVICES. OUR TOTAL LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER WILL AT ALL TIMES BE LIMITED TO THE AMOUNT PAID BY YOU TO US IN THE THREE (3) MONTH PERIOD PRIOR TO ANY CAUSE OF ACTION ARISING.",
      "NOTHING IN THESE LEGAL TERMS EXCLUDES OR LIMITS OUR LIABILITY FOR DEATH OR PERSONAL INJURY CAUSED BY OUR NEGLIGENCE, FOR FRAUD OR FRAUDULENT MISREPRESENTATION, OR FOR ANY OTHER LIABILITY THAT CANNOT BE EXCLUDED OR LIMITED UNDER THE LAW OF ENGLAND AND WALES. AS A CONSUMER, YOU HAVE STATUTORY RIGHTS (INCLUDING UNDER THE CONSUMER RIGHTS ACT 2015 THAT SERVICES BE PERFORMED WITH REASONABLE CARE AND SKILL) WHICH THESE LEGAL TERMS DO NOT AFFECT."
    ]
  },  {
    heading: "19. INDEMNIFICATION",
    paragraphs: [
      "You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable legal fees, made by any third party due to or arising out of: (1) your breach of these Legal Terms; (2) any breach of your representations and warranties; (3) your violation of the rights of a third party; or (4) any harmful act by you toward our staff, fulfilment partners, or other users. We reserve the right to assume the exclusive defence and control of any matter for which you are required to indemnify us, and you agree to cooperate with our defence of such claims."
    ]
  },  {
    heading: "20. USER DATA",
    paragraphs: [
      "We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services. Although we perform regular routine backups of data, you are responsible for the data you transmit. To the extent permitted by law and subject to our obligations under data protection legislation, we shall have no liability to you for any loss or corruption of such data."
    ]
  },  {
    heading: "21. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES",
    paragraphs: [
      "Using the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically satisfy any legal requirement that such communication be in writing. You agree to the use of electronic signatures, contracts, orders, and other records, and to electronic delivery of notices, policies, and records of transactions initiated or completed by us or via the Services."
    ]
  },  {
    heading: "22. MISCELLANEOUS",
    paragraphs: [
      "These Legal Terms and any policies posted on the Services constitute the entire agreement between you and us. Our failure to enforce any right or provision shall not operate as a waiver. These Legal Terms operate to the fullest extent permissible by law. We may assign any or all of our rights and obligations to others at any time. If any provision is determined to be unlawful, void, or unenforceable, that provision is deemed severable and does not affect the validity of the remaining provisions. There is no joint venture, partnership, employment, or agency relationship created between you and us as a result of these Legal Terms or use of the Services."
    ]
  },  {
    heading: "23. CONTACT US",
    paragraphs: [
      "In order to resolve a complaint regarding the Services or to receive further information regarding use of the Services, please contact us at:",
      "EAZILYCHINA LTD, Tms House, Cray Avenue, Orpington, England BR5 3QB, United Kingdom · andrea@eazilychina.com"
    ]
  }
  ]
};

export const COOKIES_POLICY: LegalDocument = {
  slug: "cookies",
  title: "Cookie Policy",
  lastUpdated: "22 July 2026",
  version: "1.0",
  sections: [
  {
    paragraphs: [
      "This Cookie Policy explains how EAZILYCHINA LTD ('we', 'us', or 'our') uses cookies and similar storage technologies when you use our website https://eazilychina.com and our mobile application eazilyChina (together, the 'Services'). It should be read together with our Privacy Policy."
    ]
  },  {
    heading: "1. WHAT ARE COOKIES AND SIMILAR TECHNOLOGIES?",
    paragraphs: [
      "Cookies are small text files placed on your device by a website. Because much of our app runs as a web application inside a mobile wrapper, we also rely on similar browser storage technologies that do a comparable job: local storage (small pieces of data saved by the app in your device's browser storage) and service worker caching (which stores parts of the app on your device so it loads quickly and works more reliably). In this policy, 'cookies' refers to all of these technologies."
    ]
  },  {
    heading: "2. WHAT WE USE, AND WHY",
    paragraphs: [
      
    ]
  },  {
    subheading: "Strictly necessary",
    paragraphs: [
      "These are required for the Services to work and cannot be switched off in our systems:",
      "- Authentication and session storage — keeps you signed in securely to your account.",
      "- Security and fraud prevention — our payment processor, Stripe, sets cookies necessary to process payments securely and prevent fraud when you use checkout. See Stripe's policy at https://stripe.com/gb/privacy.",
      "- Service worker cache — stores app files on your device so the app loads quickly and remains usable on poor connections."
    ]
  },  {
    subheading: "Functional",
    paragraphs: [
      "These remember choices you make so the app behaves the way you set it:",
      "- Your preferences — for example your preferred currency and language settings.",
      "- Interface state — for example notifications you have dismissed, so we do not show them again."
    ]
  },  {
    subheading: "What we do not use",
    paragraphs: [
      "We do not use advertising cookies, retargeting, cross-site tracking, or social media tracking pixels, and we do not permit third parties to place advertising technologies on our Services."
    ]
  },  {
    heading: "3. THIRD-PARTY SERVICES",
    paragraphs: [
      "Some features rely on third-party services that may set their own strictly necessary cookies or process technical data when you use them: Stripe (payments, as above) and Apple Maps / MapKit (when you use map features, Apple processes map requests under its own privacy terms). We do not control these third parties' technologies; links to their policies are provided in our Privacy Policy."
    ]
  },  {
    heading: "4. HOW LONG DOES STORED DATA LAST?",
    paragraphs: [
      "Session-related storage lasts while you are signed in and for a period afterwards to keep you signed in between visits. Preference storage lasts until you change the preference, clear your browser or app data, or delete your account. Cached app files are replaced automatically when we publish an update."
    ]
  },  {
    heading: "5. HOW CAN YOU CONTROL COOKIES?",
    paragraphs: [
      "You can clear or block cookies and site data through your browser or device settings, and you can clear the app's stored data by clearing browsing data for the app's website or reinstalling the app. Because everything we store is strictly necessary or functional, blocking or clearing it may sign you out, reset your preferences, or stop parts of the Services working. We do not currently show a cookie consent banner because we do not use advertising or analytics cookies that require consent; if that changes, we will update this policy and ask for your consent where required."
    ]
  },  {
    heading: "6. CHANGES TO THIS POLICY",
    paragraphs: [
      "We may update this Cookie Policy from time to time. The updated version will be indicated by an updated 'Last updated' date at the top of this policy."
    ]
  },  {
    heading: "7. CONTACT US",
    paragraphs: [
      "If you have questions about this Cookie Policy, contact us at andrea@eazilychina.com or by post at EAZILYCHINA LTD, Tms House, Cray Avenue, Orpington, England BR5 3QB, United Kingdom."
    ]
  }
  ]
};

export const LEGAL_DOCUMENTS: LegalDocument[] = [PRIVACY_POLICY, TERMS_AND_CONDITIONS, COOKIES_POLICY];
