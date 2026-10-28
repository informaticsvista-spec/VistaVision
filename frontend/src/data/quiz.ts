export interface QuizQuestion {
  id: string;
  topic: "Artificial Intelligence" | "Machine Learning" | "Computer Vision" | "Data Science" | "Data Visualization" | "Predictions & Confidence";
  question: string;
  options: string[];
  answer: number; // index into options
  explanation: string;
}

export const QUIZ: QuizQuestion[] = [
  { id: "ai1", topic: "Artificial Intelligence", question: "Which description fits Artificial Intelligence best?", options: ["Computer programs that do tasks that normally need human intelligence", "A very fast calculator", "A type of internet connection", "A robot with a human face"], answer: 0, explanation: "AI is about making computers perform tasks like recognising pictures, understanding speech or making decisions." },
  { id: "ai2", topic: "Artificial Intelligence", question: "A voice assistant understanding what you say is an example of…", options: ["Artificial Intelligence", "A spreadsheet formula", "A printer driver", "Wi-Fi"], answer: 0, explanation: "Understanding speech is a classic AI task." },
  { id: "ml1", topic: "Machine Learning", question: "In machine learning, a model learns mainly from…", options: ["Examples (data)", "Being switched on for a long time", "Bigger screens", "Typing speed"], answer: 0, explanation: "A model finds patterns in many examples instead of following hand-written rules." },
  { id: "ml2", topic: "Machine Learning", question: "Our digit recogniser was trained on thousands of…", options: ["Handwritten digit images", "Weather reports", "Songs", "Maps"], answer: 0, explanation: "It learned from the MNIST collection of 70,000 handwritten digits." },
  { id: "cv1", topic: "Computer Vision", question: "What is Computer Vision?", options: ["Teaching computers to understand images and video", "Making screens brighter", "Fixing broken monitors", "Drawing with a mouse"], answer: 0, explanation: "Computer vision lets computers find faces, read digits and spot objects in pictures." },
  { id: "cv2", topic: "Computer Vision", question: "Face detection answers which question?", options: ["Where are the faces in this picture?", "What is this person's name?", "How old is this person?", "Where does this person live?"], answer: 0, explanation: "Detection only finds faces. VistaVision never works out who anyone is." },
  { id: "cv3", topic: "Computer Vision", question: "Why do we resize and clean a photo of handwriting before the AI reads it?", options: ["The model expects images that look like the ones it learned from", "To make the file bigger", "To add colour", "Because AI cannot read paper"], answer: 0, explanation: "Preprocessing makes new images match the training data, which helps predictions." },
  { id: "ds1", topic: "Data Science", question: "Data Science is mainly about…", options: ["Finding useful answers in data", "Building computer cases", "Typing faster", "Repairing phones"], answer: 0, explanation: "Data scientists collect, clean, analyse and explain data." },
  { id: "ds2", topic: "Data Science", question: "You count 5 apples, 3 bananas and 2 oranges. How many pieces of fruit is that?", options: ["10", "8", "5", "15"], answer: 0, explanation: "5 + 3 + 2 = 10." },
  { id: "dv1", topic: "Data Visualization", question: "Which chart is best for comparing how many apples, bananas and oranges there are?", options: ["A bar chart", "A photograph", "A map", "A clock"], answer: 0, explanation: "Bar charts make it easy to compare amounts between categories." },
  { id: "dv2", topic: "Data Visualization", question: "A pie (donut) chart shows…", options: ["How a whole is split into parts", "How something changes every second", "Where places are", "Nothing useful"], answer: 0, explanation: "Each slice is a share of the total, so the slices add up to 100%." },
  { id: "pc1", topic: "Predictions & Confidence", question: "The AI says “7 — 62% confident”. What does that mean?", options: ["It is fairly but not completely sure, and it could be wrong", "It is always right", "The answer is 62", "It is guessing randomly"], answer: 0, explanation: "Confidence shows how sure the model is. High confidence can still be wrong." },
  { id: "pc2", topic: "Predictions & Confidence", question: "The AI labels a face “Happy”. The most honest way to describe this is…", options: ["An estimate of the visible expression that can be wrong", "A fact about how the person feels", "A test of honesty", "A way to identify the person"], answer: 0, explanation: "Expressions do not always match feelings, so this is only an estimate of what the face looks like." },
  { id: "pc3", topic: "Predictions & Confidence", question: "If the AI is only 40% sure, a good response is to…", options: ["Try again with a clearer input", "Believe it anyway", "Switch off the computer", "Ignore the percentage"], answer: 0, explanation: "A clearer photo or bigger handwriting often raises confidence. Low confidence is a sign to double-check." },
];

export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface PreparedQuestion extends Omit<QuizQuestion, "options" | "answer"> {
  options: string[];
  answer: number;
}

export function prepareQuiz(count = 8, rand: () => number = Math.random): PreparedQuestion[] {
  return shuffle(QUIZ, rand).slice(0, count).map((q) => {
    const order = shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })), rand);
    return { ...q, options: order.map((o) => o.text), answer: order.findIndex((o) => o.correct) };
  });
}
