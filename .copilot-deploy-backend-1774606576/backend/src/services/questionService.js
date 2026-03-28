/**
 * Question Service
 * Handles question-related operations
 */

const supabase = require('../config/supabase');

/**
 * Process Excel questions data and insert into database
 * @param {Array} excelData - Parsed Excel rows
 * @param {Number} packageId - Package ID to associate questions with
 * @returns {Array} - Inserted questions
 */
const processExcelQuestions = async (excelData, packageId) => {
  try {
    // Transform data
    const questions = excelData.map((row) => ({
      package_id: parseInt(packageId),
      number: row.number,
      question_text: row.question_text,
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      option_e: row.option_e,
      correct_answer: row.correct_answer,
      explanation: row.explanation || null,
      category: row.category || null, // TWK, TIU, TKP
      point_a: row.point_a || null,
      point_b: row.point_b || null,
      point_c: row.point_c || null,
      point_d: row.point_d || null,
      point_e: row.point_e || null,
      image_url: row.image_url || null,
      created_at: new Date().toISOString(),
    }));

    // Insert to database
    const { data, error } = await supabase
      .from('questions')
      .insert(questions)
      .select();

    if (error) {
      throw new Error(`Failed to insert questions: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    throw new Error(`Question processing error: ${error.message}`);
  }
};

/**
 * Get questions by package ID
 * @param {Number} packageId - Package ID
 * @returns {Array} - Questions array
 */
const getQuestionsByPackage = async (packageId) => {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('package_id', packageId)
      .order('number', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  } catch (error) {
    throw new Error(`Failed to fetch questions: ${error.message}`);
  }
};

/**
 * Get single question by ID
 * @param {Number} id - Question ID
 * @returns {Object} - Question data
 */
const getQuestionById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error('Question not found');
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to fetch question: ${error.message}`);
  }
};

/**
 * Update question
 * @param {Number} id - Question ID
 * @param {Object} updateData - Data to update
 * @returns {Object} - Updated question
 */
const updateQuestion = async (id, updateData) => {
  try {
    const { data, error } = await supabase
      .from('questions')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to update question: ${error.message}`);
  }
};

/**
 * Delete question
 * @param {Number} id - Question ID
 */
const deleteQuestion = async (id) => {
  try {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    throw new Error(`Failed to delete question: ${error.message}`);
  }
};

module.exports = {
  processExcelQuestions,
  getQuestionsByPackage,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
};
