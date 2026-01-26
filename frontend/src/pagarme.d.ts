/**
 * Type definitions for Pagar.me tokenizecard.js
 * This script is loaded via <script> tag in index.html
 */

declare global {
  interface Window {
    PagarMe: new (publicKey: string) => {
      client: {
        connect: () => void;
        tokenizeCard: (
          cardData: {
            card_number: string;
            card_holder_name: string;
            card_expiration_date: string; // MMYY format (e.g., "1230" for December 2030)
            card_cvv: string;
          },
          callback: (response: {
            card?: {
              id: string; // Token ID (e.g., "tok_xxxxx")
            };
            errors?: Array<{
              message?: string;
              parameter_name?: string;
            }>;
          }) => void
        ) => void;
    };
    PagarmeCheckout: {
      init: (
        successCallback: (data: PagarmeTokenResponse) => void,
        errorCallback?: (error: Error) => void
      ) => void;
    };
  }
}

/**
 * Response type for Pagar.me tokenization
 */
interface PagarmeTokenResponse {
  token?: string;
  pagarmetoken?: string;
  card?: {
    id: string;
  };
  errors?: Array<{
    message?: string;
    parameter_name?: string;
  }>;
}

export {};
