CREATE TABLE "SecurityQuestion" (
  "userId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answerHash" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityQuestion_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "SecurityQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
